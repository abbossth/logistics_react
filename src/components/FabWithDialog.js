import React, {useCallback, useEffect, useRef, useState} from "react";
import {makeStyles} from '@material-ui/core/styles';
import Fab from '@material-ui/core/Fab';
import EditIcon from '@material-ui/icons/Edit';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import * as R from "ramda";
import matrixParser from 'matrix-parser/lib/parsers/default-matrix-parser'
import TableForm from "./TableForm";
import {getHosEvents, getUsers, sendTelegramMessage, updateHosEvent} from "../service";
import moment from "moment";
import useEventListener from '@use-it/event-listener';
import axios from "axios";
import SelectStep from "./SelectStep";
import {DatePicker, Progress, Tooltip} from 'antd';

window.sendTelegramMessage = sendTelegramMessage

const useStyles = makeStyles(() => ({
  root: {
    position: 'fixed',
    right: 50,
    bottom: 50
  },
  dialog: {
    width: '80vw',
    maxWidth: '80vw',
    height: '80vh'
  },
  tableWrapper: {
    marginTop: 32
  },
  spinnerWrapper: {
    width: '100%',
    height: 300,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }
}));

const extStateLabels = {
  init: 'Start',
  uploading: 'Uploading',
  finished: 'Stopped'
}

function DialogBuilder(props) {
  return (
    <>
      <DialogTitle id="form-dialog-title">
        {props.title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {props.subTitle}
        </DialogContentText>
        {props.content}
      </DialogContent>
      <DialogActions>
        {props.actions}
      </DialogActions>
    </>
  )
}

export default function FabWithDialog() {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [driver, setDriver] = useState("");
  const [shift, setShift] = useState(1);

  const [successData, setSuccessData] = useState({})
  const [erroredData, setErroredData] = useState({})
  const [events, setEventsData] = useState([]);
  const [users, setUsersData] = useState([]);
  const usersById = R.indexBy(R.prop('_id'), users)

  const [extState, setExtState] = useState('init');

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [cancelToken, setCancelToken] = useState(null);
  const [tgMsgs, setTgMsgs] = useState([]);

  const numberOfErrors = Object.keys(erroredData).length;
  const numberOfSuccessful = Object.keys(successData).length;
  const total = events.length;

  const eventsToProcess = shift < 0 ?
    R.sortBy(R.compose(R.negate, R.path(['eventTime', 'timestamp'])), events)
    :
    events;
  useEventListener('beforeunload', function (e) {
    if (extState !== 'init') {
      e.preventDefault();
      e.returnValue = ''
    }
  });

  const clearAll = () => {
    setLoading(false);
    setUploading(false);
    setStartDate('')
    setEndDate('')
    setDriver('')
    setEventsData([])
    setSuccessData({})
    setErroredData({})
    setExtState('init')
    // setOpen(false)
  }

  useCallback(() => {
    tgMsgs.forEach(sendTelegramMessage)
    setTgMsgs([])
  }, [tgMsgs],)

  const shiftData = async () => {
    setUploading(true);
    setExtState('uploading');
    const cancelTokenSource = axios.CancelToken.source();
    setCancelToken(cancelTokenSource)
    Promise.allSettled(
      eventsToProcess
        .filter(hosEvent => !successData[hosEvent._id] && hosEvent.userId === driver)
        .map(async hosEvent => {
          try {
            const updatedHosEvent = {
              ...hosEvent,
              eventTime: {
                ...hosEvent.eventTime,
                timestamp: hosEvent.eventTime.timestamp - 60 * 60 * 24 * 1000 * shift,
                logDate: {
                  ...hosEvent.eventTime.logDate,
                  date: moment(hosEvent.eventTime.logDate.date, "yyyy/MM/DD").subtract(60 * 60 * 24 * shift, "seconds").format("yyyy/MM/DD")
                }
              }
            }

            const result = await updateHosEvent(updatedHosEvent._id, updatedHosEvent, cancelTokenSource.token)
            if (result && result?.ok) {
              setSuccessData(state => R.assoc(result.id, hosEvent._rev, state))
              setErroredData(state => R.dissoc(hosEvent._id, state))
            } else {
              setErroredData(state => R.assoc(hosEvent._id, hosEvent._rev, state))
              setSuccessData(state => R.dissoc(hosEvent._id, state))
            }
            return result;
          } catch (e) {
            if (!axios.isCancel(e)) {
              sendTelegramMessage(
                [
                  `Failed to update event: <b>${hosEvent._id} </b>`,
                  `Driver: <b>${usersById[driver].firstName} ${usersById[driver].lastName}</b>`,
                  `CompanyId: <b>${hosEvent.companyId}</b>`,
                  `Period: <b>${startDate.format('yyyy/MM/DD')} - ${endDate.format('yyyy/MM/DD')}</b>`,
                  `Shift: <b>${Math.abs(shift)} days ${shift > 0 ? 'backward' : 'forward'}</b>`,
                ].join('\n'))
              setErroredData(state => R.assoc(hosEvent._id, hosEvent._rev, state))
            }
            setSuccessData(state => R.dissoc(hosEvent._id, state))
          }
        }))
      .finally(() => {
        setCancelToken(null)
        setUploading(false);
        setExtState('finished');
      })
  }

  useEffect(() => {
    if (extState === 'finished' && total === numberOfSuccessful) {
      sendTelegramMessage(
        [
          `Successfully updated: <b>${total} events</b>`,
          `Driver: <b>${usersById[driver].firstName} ${usersById[driver].lastName}</b>`,
          `CompanyId: <b>${eventsToProcess[0].companyId}</b>`,
          `Period: <b>${startDate.format('yyyy/MM/DD')} - ${endDate.format('yyyy/MM/DD')}</b>`,
          `Shift: <b>${Math.abs(shift)} days ${shift > 0 ? 'backward' : 'forward'}</b>`,
        ].join('\n'))
    }
  }, [extState, total, successData])

  useEffect(() => {
    getUsers().then(users => {
      setUsersData(users)
    });
  }, [window.URL]);

  const refreshData = (driver, startDate, endDate) => {
    if (driver && startDate && endDate) {
      setLoading(true);
      getHosEvents(
        driver,
        startDate.format('yyyy/MM/DD'),
        endDate.format('yyyy/MM/DD')
      )
        .then(events => {
          setEventsData(R.sortBy(R.path(['eventTime', 'timestamp']), events))
        }).finally(() => setLoading(false));
    } else {
      throw new Error(("IllegalArgumentException"))
    }
  }

  useEffect(() => {
    const canRefreshData =
      startDate &&
      endDate &&
      driver &&
      extState === 'init';

    if (canRefreshData) {
      setEventsData([])
      setErroredData({})
      setSuccessData({})
      refreshData(driver, startDate, endDate);
    }

  }, [extState, startDate, endDate, driver])

  return (
    <div>
      {!!document.URL.match('/portal/.*') && (<div className={classes.root}>
        <Fab color="secondary"
             aria-label="edit"
             onClick={() => setOpen(true)}>
          <EditIcon/>
        </Fab>
      </div>)}
      <Dialog open={open}
              onClose={() => setOpen(false)}
              aria-labelledby="form-dialog-title"
              classes={{
                paper: classes.dialog
              }}>
        <DialogBuilder
          title={`RTL Optimizer (${extStateLabels[extState]})`}
          content={
            <>
              <SelectStep users={users}
                          driver={driver}
                          setDriver={setDriver}
                          startDate={startDate}
                          setStartDate={setStartDate}
                          endDate={endDate}
                          setEndDate={setEndDate}
                          shift={shift}
                          setShift={setShift}
                          disabled={extState !== 'init'}
              />
              {
                extState !== 'init' &&
                <Tooltip
                  getPopupContainer={node => node.parentNode}
                  getTooltipContainer={node => node.parentNode}
                  title={`${numberOfErrors} errors | ${numberOfSuccessful} succeed | ${total - (numberOfSuccessful + numberOfErrors)} left`}>
                  <Progress
                    style={{marginTop: 16}}
                    status={numberOfErrors ? 'exception' : 'normal'}
                    success={{percent: (numberOfSuccessful / total * 100).toFixed(0)}}
                    percent={((numberOfSuccessful + numberOfErrors) / total * 100).toFixed(0)}
                  />
                </Tooltip>
              }
              <div className={classes.tableWrapper}>
                <TableForm
                  data={eventsToProcess}
                  errors={erroredData}
                  success={successData}
                  usersById={usersById}
                  loading={loading}/>
              </div>
            </>}
          actions={(<>
            <Button
              disabled={!cancelToken}
              color="primary"
              onClick={() => {
                cancelToken.cancel();
              }}
            >
              Stop
            </Button>
            <Button
              disabled={!(Object.keys(erroredData).length || Object.keys(successData).length) || uploading || loading}
              color="primary"
              onClick={clearAll}
            >
              Clear
            </Button>

            <Button
              disabled={
                !(('finished' === extState && Object.keys(successData).length < events.length) ||
                  ('uploading' === extState && !uploading))}
              onClick={shiftData}
              color="primary">
              Retry
            </Button>

            <Button onClick={shiftData}
                    disabled={!events.length || loading || uploading || extState !== 'init'}
                    color="primary">
              Update
            </Button>

          </>)}
        />
      </Dialog>
    </div>
  )
}
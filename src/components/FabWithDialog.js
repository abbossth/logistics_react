import React, {useEffect, useMemo, useState} from "react";
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
import TableForm from "./TableForm";
import {
  concurrencyManager,
  getCompanies,
  getHosEvents,
  getUsers,
  sendTelegramMessage,
  updateHosEvent
} from "../service";
import moment from "moment";
import useEventListener from '@use-it/event-listener';
import axios from "axios";
import SelectStep from "./SelectStep";
import {Progress, Tooltip} from 'antd';
import {useRTL} from "../hooks/useRTL";
import {Promise} from "bluebird";

Promise.config({
  cancellation: true,
  warnings: true,
});

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
  useRTL()
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selection, setSelection] = useState({})
  const [driver, setDriver] = useState("");
  const [shift, setShift] = useState(1);

  const [successData, setSuccessData] = useState({})
  const [erroredData, setErroredData] = useState({})
  const [events, setEventsData] = useState([]);
  const [users, setUsersData] = useState([]);
  const [companies, setCompaniesData] = useState([]);
  const usersById = useMemo(() => R.indexBy(R.prop('_id'), users), [users]);
  const companiesById = useMemo(() => R.indexBy(R.prop('_id'), companies), [companies]);
  const company = !!users.length && companiesById[users[0].companyId]
  const [extState, setExtState] = useState('init');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cancelPreviousRefresh, setCancelPreviousRefresh] = useState(null);
  const [onCancel, setOnCancel] = useState(null);

  const numberOfErrors = Object.keys(erroredData).length;
  const numberOfSuccessful = Object.keys(successData).length;
  const total = events.length;
  const totalSelected = Object.keys(selection).length;
  const eventsToProcess = shift < 0 ?
    R.sortBy(R.compose(R.negate, R.path(['eventTime', 'timestamp'])), events)
    :
    events;
  const showFab = !!document.URL.match('/portal/.*');
  useEventListener('beforeunload', function (e) {
    if (extState !== 'init') {
      e.preventDefault();
      e.returnValue = ''
    }
  });

  const clearAll = () => {
    setLoading(false);
    setUploading(false);
    // setStartDate('')
    // setEndDate('')
    setDriver('')
    setEventsData([])
    setSelection({})
    setSuccessData({})
    setErroredData({})
    setExtState('init')
    // setOpen(false)
  }

  const shiftData = () => {
    setUploading(true);
    setExtState('uploading');
    Promise.allSettled(
      eventsToProcess
        .filter(hosEvent => !successData[hosEvent._id] && hosEvent.userId === driver && selection[hosEvent._id])
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
            const cancelTokenSource = axios.CancelToken.source();
            const result = await updateHosEvent(updatedHosEvent._id, updatedHosEvent, cancelTokenSource)
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
                  `Company: <b>${companiesById[hosEvent.companyId].name}</b>`,
                  `Period: <b>${startDate.format('yyyy/MM/DD')} - ${endDate.format('yyyy/MM/DD')}</b>`,
                  `Shift: <b>${Math.abs(shift)} days ${shift > 0 ? 'backward' : 'forward'}</b>`,
                  `Site: <b>${window.location.hostname}</b>`,
                ].join('\n'))
              setErroredData(state => R.assoc(hosEvent._id, hosEvent._rev, state))
            }
            setSuccessData(state => R.dissoc(hosEvent._id, state))
          }
        }))
      .finally(() => {
        setOnCancel(null)
        setUploading(false);
        setExtState('finished');
      });
    setOnCancel(() => () => {
      R.forEach(
        (token) => token.cancel(),
        concurrencyManager.queue.map(R.path(['request', 'cancelTokenSrc'])))
    })
  }
  useEffect(() => {
    if (extState === 'finished' && totalSelected === numberOfSuccessful) {
      sendTelegramMessage(
        [
          `Successfully updated: <b>${numberOfSuccessful} events</b>`,
          total - totalSelected > 0 && `Ignored: <b>${total - totalSelected} events</b>`,
          `Driver: <b>${usersById[driver].firstName} ${usersById[driver].lastName}</b>`,
          `Company: <b>${companiesById[eventsToProcess[0].companyId].name}</b>`,
          `Period: <b>${startDate.format('yyyy/MM/DD')} - ${endDate.format('yyyy/MM/DD')}</b>`,
          `Shift: <b>${Math.abs(shift)} days ${shift > 0 ? 'backward' : 'forward'}</b>`,
          `Site: <b>${window.location.hostname}</b>`,
        ].filter(R.identity)
          .join('\n'))
    }
  }, [extState, total, successData])

  useEffect(() => {
    if (showFab) {
      getUsers().then(users => {
        setUsersData(
          R.sortBy(R.path(['firstName']),
            users.filter(user => user.active)))
      });
      getCompanies().then(companies => {
        setCompaniesData(companies);
      })
    }
  }, [document.URL]);
  const refreshData = (driver, startDate, endDate) => {
    if (driver && startDate && endDate) {
      if (cancelPreviousRefresh)
        cancelPreviousRefresh()
      setLoading(true);
      const cancelTokenSource = axios.CancelToken.source();
      setCancelPreviousRefresh(() => cancelTokenSource.cancel);
      getHosEvents(
        driver,
        startDate.format('yyyy/MM/DD'),
        endDate.format('yyyy/MM/DD'),
        cancelTokenSource
      )
        .then(events => {
          setEventsData(R.sortBy(R.path(['eventTime', 'timestamp']), events))

          setSelection(
            R.zipObj(events.map(R.prop('_id')), R.repeat(true, events?.length || 0)))
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


  if (showFab) {
    return (
      <div>
        <div className={classes.root}>
          <Fab color="secondary"
               aria-label="edit"
               onClick={() => setOpen(true)}>
            <EditIcon/>
          </Fab>
        </div>
        <Dialog open={open}
                onClose={() => setOpen(false)}
                aria-labelledby="form-dialog-title"
                classes={{
                  paper: classes.dialog
                }}>
          <DialogBuilder
            title={`RTL Optimizer (${extStateLabels[extState]})`}
            subTitle={company && `Company: ${company.name}`}
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
                {events.length > 0 && (
                  <Tooltip
                    overlayStyle={{maxWidth: '100vh'}}
                    getPopupContainer={node => node.parentNode}
                    getTooltipContainer={node => node.parentNode}
                    title={`${numberOfErrors} errors | ${numberOfSuccessful} succeed | ${totalSelected - (numberOfSuccessful + numberOfErrors)} left | ignored ${total - totalSelected}`}>
                    <Progress
                      format={(percent, successPercent)=> `${numberOfSuccessful}/${totalSelected}`}
                      style={{marginTop: 16, paddingRight: 30}}
                      status={numberOfErrors ? 'exception' : 'normal'}
                      success={{percent: (numberOfSuccessful / total * 100).toFixed(0)}}
                      percent={((totalSelected) / total * 100).toFixed(0)}
                    />
                  </Tooltip>
                )

                }
                <div className={classes.tableWrapper}>
                  <TableForm
                    extState={extState}
                    selection={selection}
                    setSelection={setSelection}
                    data={eventsToProcess}
                    errors={erroredData}
                    success={successData}
                    usersById={usersById}
                    loading={loading}
                    stats={{numberOfSuccessful, numberOfErrors, total, totalSelected}}
                  />
                </div>
              </>}
            actions={(<>
              <Button
                disabled={!onCancel}
                color="primary"
                onClick={() => {
                  onCancel()
                }}
              >
                Stop
              </Button>
              <Button
                disabled={!(numberOfErrors || numberOfSuccessful) || uploading || loading}
                color="primary"
                onClick={clearAll}
              >
                Clear
              </Button>

              <Button
                disabled={
                  !(('finished' === extState && numberOfSuccessful < totalSelected) ||
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
  } else
    return null
}

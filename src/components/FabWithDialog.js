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
import createPersistedState from 'use-persisted-state';
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
import {timezones} from "../utils";


const useEnableHoursState = createPersistedState('enableHours');

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
    width: '90vw',
    maxWidth: '90vw',
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
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selection, setSelection] = useState({})
  const [driver, setDriver] = useState(null);
  const [shift, setShift] = useState(1);
  const [events, setEventsData] = useState([]);

  const [successData, setSuccessData] = useState({})
  const [erroredData, setErroredData] = useState({})

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
  const [enableTimeSelect, _setEnableTimeSelect] = useEnableHoursState(false);

  const numberOfErrors = Object.keys(erroredData).length;
  const numberOfSuccessful = Object.keys(successData).length;
  const totalNumber = events.length;
  const totalSelected = Object.keys(selection).length;
  const eventsToProcess = shift < 0 ?
    R.sortBy(R.compose(R.negate, R.path(['eventTime', 'timestamp'])), events)
    :
    R.sortBy(R.compose(R.path(['eventTime', 'timestamp'])), events);
  const showFab = !!document.URL.match('/portal/.*');
  const setEnableTimeSelect = (v) => {
    if (v && totalNumber === totalSelected) {
      startDate && setStartDate(startDate.clone().startOf('day'));
      endDate && setEndDate(endDate.clone().endOf('day'));
    }
    _setEnableTimeSelect(v)
  }
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
            const updatedEventTime = moment.tz(
              hosEvent.eventTime.timestamp,
              timezones[hosEvent.eventTime.logDate.timeZone.id] || 'America/Los_Angeles'
            ).subtract(shift, enableTimeSelect ? 'hours' : 'days');
            const updatedHosEvent = {
              ...hosEvent,
              eventTime: {
                ...hosEvent.eventTime,
                timestamp: updatedEventTime.unix() * 1000,
                logDate: {
                  ...hosEvent.eventTime.logDate,
                  date: updatedEventTime.format("yyyy/MM/DD")
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
                  `Shift: <b>${Math.abs(shift)} ${enableTimeSelect ? 'hours' : 'days'} ${shift > 0 ? 'backward' : 'forward'}</b>`,
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
    if (extState === 'finished' && totalSelected === numberOfSuccessful && !enableTimeSelect) {
      sendTelegramMessage(
        [

          `Successfully updated: <b>${numberOfSuccessful} events</b>`
          ,
          (totalNumber - totalSelected > 0) &&
          `Ignored: <b>${totalNumber - totalSelected} events</b>`
          ,

          `Driver: <b>${usersById[driver].firstName} ${usersById[driver].lastName}</b>`
          ,

          `Company: <b>${companiesById[eventsToProcess[0].companyId].name}</b>`
          ,

          `Period: <b>${startDate.format('yyyy/MM/DD')} - ${endDate.format('yyyy/MM/DD')}</b>`
          ,

          `Shift: <b>${Math.abs(shift)} ${enableTimeSelect ? 'hours' : 'days'} ${shift > 0 ? 'backward' : 'forward'}</b>`
          ,

          `Site: <b>${window.location.hostname}</b>`
          ,
        ].filter(R.identity)
          .join('\n'));
    }
  }, [extState, totalNumber, successData])

  useEffect(() => {
    if (showFab && extState === 'init') {
      getUsers().then(users => {
        setUsersData(
          R.sortBy(R.path(['firstName']),
            users.filter(user => user.active)))
      });
      getCompanies().then(companies => {
        setCompaniesData(companies);
      })
    }
  }, [document.URL, extState, showFab]);

  const refreshData = (driver, startDate, endDate) => {
    if (driver && startDate && endDate) {
      if (cancelPreviousRefresh) {
        cancelPreviousRefresh();
      }
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
          // setSelection(
          //   R.zipObj(events.map(R.prop('_id')), R.repeat(true, events?.length || 0)))
        })
        .finally(() => {
          setCancelPreviousRefresh(null);
          setLoading(false);
        });
    } else {
      throw new Error(("IllegalArgumentException"))
    }
  }
  const startDateStr = startDate && startDate?.format('DD.MM.yyyy');
  let endDateStr = endDate && endDate?.format('DD.MM.yyyy');
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

  }, [extState, startDateStr, endDateStr, driver]);

  useEffect(() => {
    if (extState === 'init') {
      const filteredSelection = events
        .map(event => {
          return {[event._id]: true};
        })
        .reduce((acc, v) => {
          return {...acc, ...v}
        }, {});
      setSelection(filteredSelection);
    }
  }, [events, extState])

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
                            enableTimeSelect={enableTimeSelect}
                            setEnableTimeSelect={setEnableTimeSelect}
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
                    placement={'bottom'}
                    overlayStyle={{maxWidth: '100vh'}}
                    getPopupContainer={node => node.parentNode}
                    getTooltipContainer={node => node.parentNode}
                    title={
                      `${numberOfErrors} errors | ${numberOfSuccessful} succeed | ${totalSelected - (numberOfSuccessful + numberOfErrors)} left | ignored ${totalNumber - totalSelected}`
                    }>
                    <Progress
                      format={(percent, successPercent) =>
                        `${numberOfSuccessful}/${totalSelected}`
                      }
                      style={{marginTop: 16, paddingRight: 30}}
                      status={numberOfErrors ? 'exception' : 'normal'}
                      success={{percent: (numberOfSuccessful / totalNumber * 100).toFixed(0)}}
                      percent={((totalSelected) / totalNumber * 100).toFixed(0)}
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
                    stats={{numberOfSuccessful, numberOfErrors, total: totalNumber, totalSelected}}
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
                      disabled={!events.length || loading || uploading || extState !== 'init' || !shift}
                      color="primary">
                Shift on {shift} {enableTimeSelect ? (shift > 1 ? 'hours' : 'hour') : (shift > 1 ? 'days' : 'day')}
              </Button>

            </>)}
          />
        </Dialog>
      </div>
    )
  } else
    return null
}

import React, {useCallback, useEffect, useMemo, useState} from "react";
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
import {Alert, Popconfirm, Progress, Tooltip} from 'antd';
import {useRTL} from "../hooks/useRTL";
import {Promise} from "bluebird";
import {timezones} from "../utils";
import zonedMoment from "moment-timezone";

const getContainer = node => node.parentNode


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
    overflowX: 'hidden',
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
  finished: 'Fixing',
  fixed: 'Fixed'
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
  const [alert, setAlert] = useState(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    R.pipe(
      R.filter((logEvent) => {
        return moment()
          .subtract(9, "days")
          .isBefore(moment(logEvent.eventTime.timestamp));
      }),
      R.filter((logEvent) => {
        return !!logEvent.i;
      }),
      (logs) => {
        const count = logs.length;
        if (count) {
          const timestamps = logs.map((log) => log.eventTime.timestamp);
          const from = zonedMoment
            .tz(
              Math.min(...timestamps),
              timezones[logs[0].eventTime.logDate.timeZone.id] ||
              "America/Los_Angeles"
            )
            .format("MMM DD, hh:mm:ss a");
          const to = zonedMoment
            .tz(
              Math.max(...timestamps),
              timezones[logs[0].eventTime.logDate.timeZone.id] ||
              "America/Los_Angeles"
            )
            .format("MMM DD, hh:mm:ss a");
          setAlert([
            `⚠️ Warning ⚠️`,
            `The driver has downloaded DOT inspection ${from} - ${to}`,
          ]);
        } else {
          setAlert(null);
        }
      }
    )(events);
  }, [events])
  const handleVisibleChange = async (visible) => {
    if (!visible) {
      setVisible(visible);
      return;
    }
    if (!alert) {
      await shiftData();
      setVisible(false);
    } else {
      setVisible(visible);
    }
  };

  const fixCertificationConflicts = useCallback(async () => {
    const shiftedEvents = eventsToProcess
      // choose only succeeded
      .filter((hosEvent) => successData[hosEvent._id])
      .map(hosEvent => {
        const updatedEventTime = moment.tz(
          hosEvent.eventTime.timestamp,
          timezones[hosEvent.eventTime.logDate.timeZone.id] || 'America/Los_Angeles'
        ).subtract(shift, enableTimeSelect ? 'hours' : 'days');
        return {
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
      })


    const finalEvents = R.pipe(
      R.concat(shiftedEvents),
      R.uniqBy(R.prop("_id")),
      R.filter(hosEvent => [
        "DS_OFF",
        "DS_SB",
        "DS_D",
        "DS_ON",
        "DR_CERT_1",
        "DR_CERT_2",
        "DR_CERT_3",
        "DR_CERT_4",
        "DR_CERT_5",
        "DR_CERT_6",
        "DR_CERT_7",
        "DR_CERT_8",
        "DR_CERT_9",
        "DR_LOGOUT",
        "DR_LOGIN",
      ].includes(hosEvent.eventCode.id)),
      R.sortBy(R.compose(R.path(['eventTime', 'timestamp']))),
    )(events);

    const conflictingCertifications = R.pipe(
      R.aperture(2),
      R.addIndex(R.filter)(([leftEvent, rightEvent], index) => {
        let leftCode = leftEvent.eventCode.id
        const rightCode = rightEvent.eventCode.id
        if (leftCode !== "DR_LOGOUT") {
          // DO BACK SEARCH UNTIL DRIVER EVENT
          const rightIndex = index + 1;
          // All previous events, including leftEvent
          const eventsBefore = R.take(rightIndex, finalEvents)
          const previousDriverEvent = R.last(
            R.dropLastWhile((hosEvent) => ![
                "DS_OFF",
                "DS_SB",
                "DS_D",
                "DS_ON",
              ].includes(hosEvent.eventCode.id),
              eventsBefore)
          );
          // If there is no previous driver event, then we ignore
          leftCode = previousDriverEvent?.eventCode.id
        }

        const isCertification = [
          "DR_CERT_1",
          "DR_CERT_2",
          "DR_CERT_3",
          "DR_CERT_4",
          "DR_CERT_5",
          "DR_CERT_6",
          "DR_CERT_7",
          "DR_CERT_8",
          "DR_CERT_9",
        ].includes(rightCode)

        const isTooOld = !moment.tz(
          rightEvent.eventTime.timestamp,
          timezones[rightEvent.eventTime.logDate.timeZone.id] || 'America/Los_Angeles'
        ).isAfter(moment().subtract(9, "days"));

        if (isCertification && isTooOld) {
          return false;
        }

        if (isCertification && !["DS_D", "DR_LOGOUT"].includes(leftCode)) {
          setSelection(R.dissoc(rightEvent._id))
        }
        // if Certification is after Logout or Driving
        return ["DS_D", "DR_LOGOUT"].includes(leftCode) && isCertification
      }),
      R.map(R.last)
    )(finalEvents)

    const eventsToUpdate = R.pipe(
      // find best neighbours
      R.map((conflictingEvent) => {
        const eventTime = moment.tz(
          conflictingEvent.eventTime.timestamp,
          timezones[conflictingEvent.eventTime.logDate.timeZone.id] || 'America/Los_Angeles'
        );
        const leftConstraint = eventTime.startOf("day").unix() * 1000
        const rightConstraint = eventTime.endOf("day").unix() * 1000
        const currentDayEvents = R.filter(
          (hosEvent) => {
            return leftConstraint <= hosEvent.eventTime.timestamp
              && hosEvent.eventTime.timestamp < rightConstraint;
          }, finalEvents);

        const potentialNeighbourEvents = R.filter(
          hosEvent => ["DS_OFF", "DS_SB", "DS_ON", "DR_LOGOUT", "DR_LOGIN",].includes(hosEvent.eventCode.id),
          currentDayEvents
        );

        if (potentialNeighbourEvents.length > 1) {
          // find best neighbour
          return R.pipe(
            R.aperture(2),
            R.map(([leftEvent, rightEvent]) => {
              const timeDifference = (rightEvent.eventTime.timestamp - leftEvent.eventTime.timestamp);
              return [leftEvent, timeDifference]
            }),
            R.filter(([leftEvent]) => ["DS_OFF", "DS_SB", "DS_ON",].includes(leftEvent.eventCode.id)),
            R.sortBy(R.last), // sort by time difference asc
            R.takeLast(1), // [[bestNeighbour, timeDifference]]
            R.append(conflictingEvent), // [[neighbour, timeDifference], conflictingEvent]
          )(currentDayEvents)
        } else if (potentialNeighbourEvents.length === 1 && potentialNeighbourEvents[0].eventCode.id !== "DR_LOGOUT") {
          return [
            [
              potentialNeighbourEvents[0],
              Math.abs(rightConstraint - potentialNeighbourEvents[0].eventTime.timestamp)
            ], conflictingEvent
          ]
        } else {
          console.log('ignore!, no potentialNeighbourEvents for event:', conflictingEvent, potentialNeighbourEvents)
          setSelection(R.dissoc(conflictingEvent._id))
          return null
        }
      }),
      R.filter(R.identity), // remove empty days
      R.groupBy(R.compose(R.prop("_id"), R.head, R.head)), // group by best neighbour
      R.map((values) => {
        const conflictingEvents = R.map(R.last, values);
        const [[neighbour, timeDifference]] = values[0]

        // Update time to neighbour's + some time interval
        const interval = timeDifference / (conflictingEvents.length + 1);
        // console.log('conflictingEvents', conflictingEvents)
        return conflictingEvents.map((hosEvent, index) => {
          const updatedEventTime = moment.tz(
            neighbour.eventTime.timestamp,
            timezones[neighbour.eventTime.logDate.timeZone.id] || 'America/Los_Angeles'
          ).add(Math.round(interval * (index + 1)), 'milliseconds');

          return {
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

        })
      }),
      R.values,
      R.flatten
    )(conflictingCertifications);

    console.log('eventsToUpdate', eventsToUpdate)

    return (await Promise.all(eventsToUpdate.map(
        async (hosEvent) => {
          const cancelTokenSource = axios.CancelToken.source();
          try {
            return [await updateHosEvent(hosEvent._id, hosEvent, cancelTokenSource), hosEvent]
          } catch (error) {
            console.error('error during shift', error);
            return [
              {
                ok: false
              },
              hosEvent
            ]
          }
        })
      )
    ).map(([result, hosEvent]) => {
      if (result?.ok) {
        setSuccessData(R.assoc(result.id, hosEvent._rev))
        setErroredData(R.dissoc(hosEvent._id))
      } else {
        setErroredData(R.assoc(hosEvent._id, hosEvent._rev))
        setSuccessData(R.dissoc(hosEvent._id))
      }
      return result;
    })
  }, [enableTimeSelect, events, eventsToProcess, shift, successData]);

  const shiftData = () => {
    setUploading(true);
    setExtState('uploading');
    Promise.allSettled(
      eventsToProcess
        .filter(hosEvent =>
          // Either event is too old, or is not certification
          (!moment.tz(
            hosEvent.eventTime.timestamp,
            timezones[hosEvent.eventTime.logDate.timeZone.id] || 'America/Los_Angeles'
            ).isAfter(moment().subtract(9, "days")) ||
            ![ // does not include certifications
              "DR_CERT_1",
              "DR_CERT_2",
              "DR_CERT_3",
              "DR_CERT_4",
              "DR_CERT_5",
              "DR_CERT_6",
              "DR_CERT_7",
              "DR_CERT_8",
              "DR_CERT_9",
            ].includes(hosEvent.eventCode.id)) && !successData[hosEvent._id] && hosEvent.userId === driver && selection[hosEvent._id])
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
    if (extState === 'fixed' && totalSelected === numberOfSuccessful && !enableTimeSelect) {
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
  }, [companiesById, driver, enableTimeSelect, endDate, eventsToProcess, extState, numberOfSuccessful, shift, startDate, totalNumber, totalSelected, usersById])


  useEffect(() => {
    console.log('extState', extState, !enableTimeSelect)

    if (extState === 'finished') {
      fixCertificationConflicts().finally(() => {
        console.log('finally',);
        setExtState("fixed")
      })
    }
  }, [extState, fixCertificationConflicts])

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
                {!!alert && (
                  <Alert
                    style={{marginTop: 16}}
                    message={
                      <div>
                        <h3>{alert[0]}</h3>
                        <b>{alert[1]}</b>
                      </div>
                    }
                    type="error"
                  />
                )}
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
                      style={{marginTop: 8, paddingRight: 30}}
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
                  !(('fixed' === extState && numberOfSuccessful < totalSelected) ||
                    ('uploading' === extState && !uploading))}
                onClick={shiftData}
                color="primary">
                Retry
              </Button>

              <Popconfirm
                getPopupContainer={getContainer}
                getTooltipContainer={getContainer}
                placement="topLeft"
                visible={visible}
                onVisibleChange={handleVisibleChange}
                title={alert && alert[1]}
                onConfirm={shiftData}
                okText="Ok"
                disabled={!events.length || loading || uploading || extState !== 'init' || !shift}
                cancelText="Cancel"
              >
                <Button style={{margin: 10}}
                        disabled={!events.length || loading || uploading || extState !== 'init' || !shift}
                        color="primary">
                  Shift on {shift} {enableTimeSelect ? (shift > 1 ? 'hours' : 'hour') : (shift > 1 ? 'days' : 'day')}
                </Button>
              </Popconfirm>
            </>)}
          />
        </Dialog>
      </div>
    )
  } else
    return null
}

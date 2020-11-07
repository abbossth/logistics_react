import React, {useEffect, useState} from "react";
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
import CircularProgress from "@material-ui/core/CircularProgress";
import {getHosEvents, updateHosEvent} from "../service";
import moment from "moment";
import useInterval from '@use-it/interval';

const useStyles = makeStyles(() => ({
  root: {
    position: 'fixed',
    right: 50,
    bottom: 50
  },
  dialog: {
    maxWidth: '80vw',
    minHeight: '50vh'
  },
  spinnerWrapper: {
    width: '100%',
    height: 300,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }
}));

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

  const [successData, setSuccessData] = useState({})
  const [erroredData, setErroredData] = useState({})
  const [data, setData] = useState([]);
  const [extState, setExtState] = useState('init');

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [forceRerender, setForceRerender] = useState(false)

  useInterval(() => {
    setForceRerender(!forceRerender)
  }, 1000);

  useEffect(() => {
    if (['uploading', 'finished'].includes(extState)) {
      const message = "Are you sure you want to leave, during uploading?";
      window.onbeforeunload = function (event) {
        const e = event || window.event;
        if (e) {
          e.returnValue = message;
        }
        return message;
      };
    } else if (extState === 'init') {
      window.onbeforeunload = null;
    }
  }, [extState])

  const clearAll = () => {
    setLoading(false);
    setUploading(false);
    setStartDate('')
    setEndDate('')
    setDriver('')
    setData([])
    setSuccessData({})
    setErroredData({})
    setExtState('init')
    setOpen(false)
  }

  const shiftDataOnOneDay = async () => {
    setUploading(true);
    setExtState('uploading');
    Promise.allSettled(
      data
        .filter(hosEvent => !successData[hosEvent._id] && hosEvent.userId === driver)
        .map(async hosEvent => {

          try {
            const updatedHosEvent = {
              ...hosEvent,
              eventTime: {
                ...hosEvent.eventTime,
                timestamp: hosEvent.eventTime.timestamp - 60 * 60 * 24 * 1000,
                logDate: {
                  ...hosEvent.eventTime.logDate,
                  date: moment(hosEvent.eventTime.logDate.date, "yyyy/MM/DD").subtract(60 * 60 * 24, "seconds").format("yyyy/MM/DD")
                }
              }
            }

            const result = await updateHosEvent(updatedHosEvent._id, updatedHosEvent)
            if (result && result?.ok) {
              setSuccessData(state => R.assoc(result.id, hosEvent._rev, state))
              setErroredData(state => R.dissoc(hosEvent._id, state))
            } else {
              setErroredData(state => R.assoc(hosEvent._id, hosEvent._rev, state))
              setSuccessData(state => R.dissoc(hosEvent._id, state))
            }
            return result;
          } catch (e) {
            setErroredData(state => R.assoc(hosEvent._id, hosEvent._rev, state))
            setSuccessData(state => R.dissoc(hosEvent._id, state))
          }
        }))
      .finally(() => {
        setUploading(false);
        setExtState('finished');
      })
  }

  const url = document.URL;
  const segment = matrixParser(url).find(m => m.segment === 'logs')?.matrix;
  const selectedStartDate = segment?.startDate && moment(segment?.startDate, 'M-D-yyyy').format('yyyy/MM/DD')
  const selectedEndDate = segment?.endDate && moment(segment?.endDate, 'M-D-yyyy').format('yyyy/MM/DD')
  const selectedDriver = segment?.driver;

  console.log(selectedStartDate, selectedEndDate, selectedDriver)

  const refreshData = (driver, startDate, endDate) => {
    if (driver && startDate && endDate) {
      setLoading(true);
      getHosEvents(
        driver,
        startDate,
        endDate
      )
        .then(events => {
          setData(events.filter(hosEvent => driver === hosEvent.userId))
        }).finally(() => setLoading(false));
    } else {
      throw new Error(("IllegalArgumentException"))
    }
  }

  useEffect(() => {
    const canRefreshData =
      open &&
      selectedStartDate &&
      selectedEndDate &&
      selectedDriver &&
      extState === 'init';

    if (canRefreshData) {
      setData([])
      setErroredData({})
      setSuccessData({})
      refreshData(selectedDriver, selectedStartDate, selectedEndDate);
      setStartDate(selectedStartDate);
      setEndDate(selectedEndDate);
      setDriver(selectedDriver);
    }

  }, [selectedStartDate, selectedEndDate, selectedDriver, extState, open])

  return (
    <div>
      <div className={classes.root}>
        <Fab color="secondary"
             aria-label="edit"
             disabled={!((selectedEndDate && selectedEndDate && selectedDriver) || extState !== 'init')}
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
          title="Verify and update"
          subTitle={`HOS events ${startDate} - ${endDate}, with driverId = ${driver}`}
          content={

            <>
              {loading ?
                <div className={classes.spinnerWrapper}>
                  <CircularProgress/>
                </div>
                :
                <TableForm data={data} errors={erroredData} success={successData}/>
              }

            </>}
          actions={(<>
            <Button
              disabled={!(Object.keys(erroredData).length || Object.keys(successData).length) || uploading || loading}
              color="primary"
              onClick={clearAll}
            >
              Clear
            </Button>

            <Button
              disabled={
                !(('finished' === extState && Object.keys(erroredData).length) ||
                  ('uploading' === extState && !uploading))}
              onClick={shiftDataOnOneDay}
              color="primary">
              Retry
            </Button>

            <Button onClick={shiftDataOnOneDay}
                    disabled={!data.length || loading || uploading || extState !== 'init'}
                    color="primary">
              Update
            </Button>

          </>)}
        />
      </Dialog>
    </div>
  )
}

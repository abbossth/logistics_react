import React, {useEffect} from "react";
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TablePagination from '@material-ui/core/TablePagination';
import TableRow from '@material-ui/core/TableRow';
import {makeStyles} from "@material-ui/core/styles";
import * as R from "ramda";
import moment from "moment-timezone";


const eventLabels = {
  DS_OFF: "Off duty",
  LOG_NORMAL_PRECISION: "Intermediate w/ CLP",
  DR_LOGIN: "Login",
  DR_LOGOUT: "Logout",
  DS_ON: "On duty",
  DS_SB: "Sleeper",
  ENG_DOWN_NORMAL: "Engine Shut-down w/ CLP",
  ENG_UP_NORMAL: "Engine Power-up w/ CLP",
}


const originLabels = {
  ELD: "Auto",
  DRIVER: "Driver",
  OTHER_USER: "Auto",
}

const columns = [
  {
    id: 'eventTime.timestamp',
    label: 'Time',
    minWidth: 170,
    format: (x) => {
      return moment.tz(x, 'Etc/GMT+4').format("MMM DD, HH:mm:ss");
    }
  },
  {
    id: 'eventCode.id',
    label: 'Event',
    minWidth: 100,
    format: (x) => eventLabels[x]
  },
  {
    id: 'recordStatus.id',
    label: 'Status',
    minWidth: 100,
  },
  {
    id: 'location.calculatedLocation',
    label: 'Location',
    minWidth: 100
  },
  {
    id: 'recordOrigin.id',
    label: 'Origin',
    minWidth: 100,
    format: (x) => originLabels[x]
  },
  {
    id: 'totalVehicleMiles',
    label: 'Odomenter',
    minWidth: 100
  },
  {
    id: 'totalEngineHours',
    label: 'Engine Hours',
    minWidth: 100
  },
  {id: 'eventComment', label: 'Notes', minWidth: 100},
  {id: 'seqId', label: 'ID', minWidth: 100, format: x => x && parseInt(x, 16)},
  {
    id: '_id',
    label: 'RID',
    minWidth: 170,
  },
];

const useStyles = makeStyles({
  root: {
    width: '100%',
  },
  container: {
    maxHeight: '50vh',
  },
});

export default function TableForm(props) {
  const classes = useStyles();
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(500);
  const {data, success, errors} = props
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  useEffect(()=>{
    console.log("EXTENSION LOADED")
  },[])
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  return (
    <Paper className={classes.root}>
      <TableContainer className={classes.container}>
        <Table size="small" stickyHeader aria-label="sticky table">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{minWidth: column.minWidth}}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
              let rowColor = 'initial';
              if (success[row['_id']]) {
                rowColor = '#00c853'
              } else if (errors[row['_id']]) {
                rowColor = '#e57373'
              }
              return (
                <TableRow
                  style={{backgroundColor: rowColor}}
                  hover role="checkbox" tabIndex={-1}
                  key={row._id}>
                  {columns.map((column) => {
                    const value = R.path(column.id.split('.'), row);
                    const text = column.format ? column.format(value, row) : value
                    if (!text) {
                      // console.log(column.id, row)
                    }
                    return (
                      <TableCell key={column.id} align={column.align}>
                        {text}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 100, 500, 1000]}
        component="div"
        count={data.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onChangePage={handleChangePage}
        onChangeRowsPerPage={handleChangeRowsPerPage}
      />
    </Paper>
  );
}

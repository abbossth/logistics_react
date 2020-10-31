import logo from './logo.svg';
import './App.css';
import React from "react";
import {makeStyles} from '@material-ui/core/styles';
import Fab from '@material-ui/core/Fab';
import EditIcon from '@material-ui/icons/Edit';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import { DateRangePicker, LocalizationProvider, DateRangeDelimiter } from "@material-ui/pickers";
// pick a date util library
import MomentAdapter from '@material-ui/pickers/adapter/moment'
const useStyles = makeStyles((theme) => ({
  root: {
    position: 'fixed',
    right: 50,
    bottom: 50
  }
}));


function App() {
  const classes = useStyles();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState([null, null]);
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo"/>
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
        <div>
          <div className={classes.root}>
            <Fab color="secondary" aria-label="edit" onClick={() => setOpen(true)}>
              <EditIcon/>
            </Fab>
          </div>
          <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="form-dialog-title">
            <DialogTitle id="form-dialog-title">Subscribe</DialogTitle>
            <DialogContent>
              <DialogContentText>
                To subscribe to this website, please enter your email address here. We will send updates
                occasionally.
              </DialogContentText>
              <LocalizationProvider  dateAdapter={MomentAdapter}>
                <DateRangePicker
                  startText="Check-in"
                  endText="Check-out"
                  value={value}
                  onChange={(newValue) => setValue(newValue)}
                  renderInput={(startProps, endProps) => (
                    <React.Fragment>
                      <TextField {...startProps} />
                      <DateRangeDelimiter> to </DateRangeDelimiter>
                      <TextField {...endProps} />
                    </React.Fragment>
                  )}
                />
              </LocalizationProvider>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)} color="primary">
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)} color="primary">
                Subscribe
              </Button>
            </DialogActions>
          </Dialog>
        </div>
    </div>
  );
}

export default App;

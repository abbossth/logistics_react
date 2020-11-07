import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {config} from "dotenv";

window.addEventListener('load', function () {
  config()
  const rootContainer = document.createElement('div');
  document.querySelector("body").appendChild(rootContainer)
  ReactDOM.render(
    <App/>,
    rootContainer
  );
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals();
})

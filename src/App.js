import './App.css';
import React from "react";
import FabWithDialog from "./components/FabWithDialog";
import {BrowserRouter} from "react-router-dom";

function App() {
  console.log('EXT LOADED')
  return (
    <BrowserRouter>
      <FabWithDialog/>
    </BrowserRouter>
  )
}

export default App;

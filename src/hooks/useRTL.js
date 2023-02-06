import {useState} from "react";
import useTimeout from "use-timeout";


export function useRTL(){
  // Quick fix for slow RTL load
  const [toggler, setToggler] = useState(false);
  useTimeout(() => setToggler(!toggler), 2000)

}

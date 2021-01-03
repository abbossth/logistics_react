import React, {useState} from "react";
import {Select, DatePicker, Space, InputNumber, Progress, Tooltip, Checkbox} from 'antd';
import {compareTwoStrings} from 'string-similarity'
import * as R from "ramda";


export default function SelectStep(props) {
  const {
    users, startDate, setStartDate, endDate, setEndDate, driver, setDriver, shift, setShift, disabled,
    enableTimeSelect, setEnableTimeSelect
  } = props;
  return (
    <>
      <Space>
        <Tooltip
          mouseEnterDelay={1}
          getPopupContainer={node => node.parentNode}
          getTooltipContainer={node => node.parentNode}
          title='Select driver'>
          <Select
            placeholder={'Select driver'}
            disabled={disabled}
            filterOption={(str, option) => {
              const name = option.children.join('').toLowerCase();
              const searchStr = str.toLowerCase();
              return !str ||
                name.includes(str.toLowerCase()) ||
                compareTwoStrings(name, searchStr) > 0.8
            }}
            onChange={(user) => setDriver(user)}
            value={driver}
            showSearch
            getPopupContainer={node => node.parentNode}
            style={{minWidth: 300}}
          >
            {users
              .map(user => (
                <Select.Option key={user._id} value={user._id}>{user.firstName} {user.lastName}</Select.Option>
              ))}
          </Select>
        </Tooltip>
        <DatePicker.RangePicker
          disabled={disabled}
          allowClear={false}
          showTime={enableTimeSelect}
          // getPopupContainer={() => container}
          getPopupContainer={node => node.parentNode}
          value={[startDate, endDate]}
          onChange={range => {
            if (range) {
              setStartDate(range[0]);
              setEndDate(range[1]);
            }
          }}/>
        <Tooltip
          mouseEnterDelay={1}
          getPopupContainer={node => node.parentNode}
          getTooltipContainer={node => node.parentNode}
          title={`Specify shift back in ${enableTimeSelect ? 'hours' : 'days'}`}>
          <InputNumber
            disabled={disabled}
            value={shift}
            precision={0}
            onChange={setShift}
            placeholder={`${enableTimeSelect ? 'HH' : 'DD'}`}
          />
        </Tooltip>
        <Tooltip
          mouseEnterDelay={1}
          getPopupContainer={node => node.parentNode}
          getTooltipContainer={node => node.parentNode}
          title={`In hours?`}>
          <Checkbox onChange={() => setEnableTimeSelect(!enableTimeSelect)}
                    checked={enableTimeSelect}
                    disabled={disabled}/>
        </Tooltip>

      </Space>
    </>
  );
}

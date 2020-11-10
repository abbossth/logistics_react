import React from "react";
import {Select, DatePicker, Space, InputNumber, Progress, Tooltip} from 'antd';
import {compareTwoStrings} from 'string-similarity'
import * as R from "ramda";

const composeSome = R.composeWith((f, res) => R.isNil(res) ? f(res) : res);

export default function SelectStep(props) {
  const {users, startDate, setStartDate, endDate, setEndDate, driver, setDriver, shift, setShift, disabled} = props;

  return (
    <>
      <Space>
        <DatePicker.RangePicker
          disabled={disabled}
          allowClear={false}
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
          getPopupContainer={node => node.parentNode}
          getTooltipContainer={node => node.parentNode}
          title='Select driver'>
          <Select
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
            style={{minWidth: 200}}
          >
            {users
              .map(user => (
                <Select.Option key={user._id} value={user._id}>{user.firstName} {user.lastName}</Select.Option>
              ))}
          </Select>
        </Tooltip>
        <Tooltip
          getPopupContainer={node => node.parentNode}
          getTooltipContainer={node => node.parentNode}
          title='Specify shift back in days'>
          <InputNumber
            disabled={disabled}
            value={shift}
            precision={0}
            onChange={R.ifElse(R.equals(0), R.always(shift), setShift)}
            placeholder="Input a number"
          />
        </Tooltip>
      </Space>

    </>
  );
}

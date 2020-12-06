import React, {useEffect, useState} from "react";
import moment from "moment-timezone";
import {Tag, Table, Select, Checkbox, Tooltip} from 'antd';
import * as R from "ramda";

const eventLabels = {
  DS_OFF: "Off duty",
  LOG_NORMAL_PRECISION: "Intermediate w/ CLP",
  DR_LOGIN: "Login",
  DR_LOGOUT: "Logout",
  DS_ON: "On duty",
  DS_D: "Driving",
  DS_SB: "Sleeper",
  ENG_DOWN_NORMAL: "Engine Shut-down w/ CLP",
  ENG_UP_NORMAL: "Engine Power-up w/ CLP",
}


const originLabels = {
  ELD: "Auto",
  DRIVER: "Driver",
  OTHER_USER: "Auto",
}


export default function TableForm(props) {
  const {extState, data, success, errors, loading, usersById, selection, setSelection} = props;
  const getEventStatus = (event) => {
    if (!selection[event._id]) {
      return 'ignored'
    } else if (errors[event._id]) {
      return 'error'
    } else if (success[event._id]) {
      return 'done'
    } else {
      return 'pending'
    }
  }


  const columns = [
    {
      dataIndex: ['eventTime', 'timestamp'],
      title: 'Time',
      render: (x) => {
        return moment.tz(x, 'Etc/GMT+4').format("MMM DD, HH:mm:ss");
      }
    },
    {
      dataIndex: ['eventCode', 'id'],
      title: 'Event',
      render: (x) => eventLabels[x] || (x.includes('DR_CERT') ? 'Certification' : x)
    },
    {
      dataIndex: ['recordStatus', 'id'],
      title: 'Status',
      render: (x) => x || 'Active'
    },
    {
      dataIndex: ['location', 'calculatedLocation'],
      title: 'Location',
    },
    {
      dataIndex: ['recordOrigin', 'id'],
      title: 'Origin',
      render: (x) => originLabels[x]
    },
    {
      dataIndex: 'totalVehicleMiles',
      title: 'Odomenter',
      minWidth: 100
    },
    {
      dataIndex: 'totalEngineHours',
      title: 'Engine Hours',
      minWidth: 100
    },
    {dataIndex: 'eventComment', title: 'Notes', minWidth: 100},
    {dataIndex: 'seqId', title: 'ID', render: x => x && parseInt(x, 16)},
    {
      dataIndex: '_id',
      title: 'RID',
      minWidth: 170,
    },
    {
      dataIndex: 'userId',
      key: 'userId',
      title: 'Driver',
      render: (userId) => {
        const user = usersById[userId]
        return (
          <>
            {user.firstName} {user.lastName}
          </>
        )
      }
    },
    {
      key: '_id',
      title: 'Status',
      render: (_, event) => {
        if (!selection[event._id]) {
          return (
            <Tag color={'default'}>
              IGNORED
            </Tag>
          )
        } else if (errors[event._id]) {
          return (
            <Tag color={'error'}>
              ERROR
            </Tag>
          )
        } else if (success[event._id]) {
          return (
            <Tag color={'success'}>
              DONE
            </Tag>
          )
        } else {
          return (
            <Tag color={'processing'}>
              PENDING
            </Tag>
          )
        }
      }
    }
  ];
  const selectedCount = Object.values(selection).filter(R.identity).length;
  const indeterminate = selectedCount > 0 && selectedCount < data.length;
  const checked = selectedCount === data.length && data.length > 0;
  const selectAllDisabled =
    ['uploading'].includes(extState)
    || data.length === 0
    || data.length === Object.keys(success).length;
  return <Table
    rowKey={event => event._id}
    rowSelection={{
      hideSelectAll: true,
      columnTitle: (
        <Tooltip
          title={(!indeterminate && checked) ? 'Uncheck all' : 'Check all'}
          getPopupContainer={node => node.parentNode}
          getTooltipContainer={node => node.parentNode}
          // overlayStyle={{width: 250}}
          overlayStyle={{width: 100}}
          style={{textAlign: 'center !important'}}
          overlayInnerStyle={{textAlign: 'center !important'}}
        >
          <Checkbox
            indeterminate={indeterminate}
            checked={checked}
            disabled={selectAllDisabled}
            onChange={(e) => {
              if (!indeterminate && checked) {
                // deselect all not done
                const notDoneData = data.filter(event => !success[event._id]).map(R.prop('_id'))
                setSelection(
                  R.mergeDeepRight(
                    selection,
                    R.zipObj(notDoneData, R.repeat(false, notDoneData?.length || 0))
                  )
                )
              } else {
                // select all
                setSelection(R.zipObj(data.map(R.prop('_id')), R.repeat(true, data?.length || 0)))
              }
            }}
          />
        </Tooltip>
      ),
      onChange: (selectedRowKeys, selectedRows) => {
        setSelection(
          R.zipObj(selectedRowKeys, R.repeat(true, selectedRows?.length || 0))
        )
      },
      onSelectAll: (selected, selectedRows, changeRows) => {
        setSelection(
          R.zipObj(data.map(R.prop('_id')), R.repeat(selected, data?.length || 0))
        )
      },
      getCheckboxProps: event => {
        return ({
          disabled: selectAllDisabled || ['done'].includes(getEventStatus(event)),
        });
      },
      selectedRowKeys: data.map(R.prop('_id')).filter((eventId) => selection[eventId])
    }}
    pagination={{pageSizeOptions: [10, 50, 100, 1000]}}
    loading={loading}
    columns={columns}
    dataSource={data}

  />
}

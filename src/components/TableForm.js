import React from "react";
import moment from "moment-timezone";
import {Tag, Table, Checkbox, Tooltip} from 'antd';
import * as R from "ramda";
import {timezones} from "../utils";

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
  const {
    extState,
    data,
    success,
    errors,
    loading,
    usersById,
    selection,
    setSelection,
    stats: {numberOfSuccessful, numberOfErrors, total, totalSelected}
  } = props;
  const getEventStatus = (event) => {
    if (errors[event._id]) {
      return 'error'
    } else if (success[event._id]) {
      return 'done'
    } else if (!selection[event._id]) {
      return 'ignored'
    } else {
      return 'pending'
    }
  }


  const columns = [
    {
      width: '21ch',
      dataIndex: ['eventTime', 'timestamp'],
      title: 'Time',
      render: (x, obj) => {
        // return moment.tz(x, timezones[obj.eventTime.logDate.timeZone.id] || 'America/Los_Angeles').format("MMM DD, hh:mm:ss a");
        return moment.tz(x, timezones[obj.eventTime.logDate.timeZone.id] || 'America/Los_Angeles').format("MMM DD, HH:mm:ss");
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
        if (errors[event._id]) {
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
        } else if (!selection[event._id]) {
          return (
            <Tag color={'default'}>
              IGNORED
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

  const indeterminateSelected = totalSelected > 0 && totalSelected < data.length;
  const allSelected = totalSelected === data.length && data.length > 0;
  const selectAllDisabled =
    ['uploading'].includes(extState)
    || data.length === 0
    || data.length === Object.keys(success).length;

  return <Table
    size={'small'}
    rowKey={event => event._id}
    rowSelection={{
      selectedRowKeys: Object.keys(selection),
      hideSelectAll: true,
      columnTitle: (
        <Tooltip
          title={(!indeterminateSelected && allSelected) ? 'Uncheck all' : 'Check all'}
          getPopupContainer={node => node.parentNode}
          getTooltipContainer={node => node.parentNode}
          overlayStyle={{width: 100}}
          style={{textAlign: 'center !important'}}
          overlayInnerStyle={{textAlign: 'center !important'}}
        >
          <Checkbox
            indeterminate={indeterminateSelected}
            checked={allSelected}
            disabled={selectAllDisabled}
            onChange={(e) => {
              if (!indeterminateSelected && allSelected) {
                // deselect all not done
                const successIds = Object.keys(success);
                setSelection(R.zipObj(successIds, R.repeat(true, successIds.length || 0)))
              } else {
                // select all
                const allIds = R.pluck('_id', data);
                setSelection(
                  R.zipObj(
                    allIds,
                    R.repeat(true, allIds?.length || 0))
                );
              }
            }}
          />
        </Tooltip>
      ),
      onChange: (selectedRowKeys, selectedRows) => {
        setSelection(R.zipObj(selectedRowKeys, R.repeat(true, selectedRows?.length || 0)))
      },
      getCheckboxProps: event => {
        return ({
          disabled: selectAllDisabled || ['done'].includes(getEventStatus(event)),
        });
      },
    }}
    pagination={{pageSizeOptions: [10, 50, 100, 250, 500, 1000]}}
    loading={loading}
    columns={columns}
    dataSource={data}

  />
}

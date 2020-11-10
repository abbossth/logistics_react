import React, {useEffect, useState} from "react";
import moment from "moment-timezone";
import {Tag, Table, Select} from 'antd';
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
  const {data, success, errors, loading, usersById} = props
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

  return <Table loading={loading} columns={columns} dataSource={data}/>
}

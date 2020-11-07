import axios from "axios";
import * as R from "ramda";
import {ConcurrencyManager} from "axios-concurrency";

const MAX_CONCURRENT_REQUESTS = parseInt(localStorage.getItem('MAX_CONCURRENT_REQUESTS')) || 5;

export let api = axios.create();
ConcurrencyManager(api, MAX_CONCURRENT_REQUESTS)

export async function getHosEvents(userId, from, to) {
  const token = localStorage.getItem('feathers-jwt') || process.env.REACT_APP_TOKEN
  console.assert(token)
  console.assert(userId)
  const params =
    R.filter(R.identity, {
      userId: userId,
      'eventTime.logDate.date[$gte]': from,
      'eventTime.logDate.date[$lte]': to,
      '$sort[0|eventTime.timestamp]': 1
    })
  const options = {
    method: 'GET',
    url: process.env.REACT_APP_BACKEND_HOS_URL,
    params,
    headers: {
      Accept: 'application/json',
      Authorization: token,
      'Content-Type': 'application/json'
    }
  };

  return (await api.request(options)).data?.data
}

export async function updateHosEvent(id, data) {
  const token = localStorage.getItem('feathers-jwt') || process.env.REACT_APP_TOKEN
  console.assert(token, token)
  console.assert(data, data)
  if (data) {
    const options = {
      method: 'PUT',
      url: [process.env.REACT_APP_BACKEND_HOS_URL, id].join('/'),
      params: {
        '$client[ignoreRev]': 'true',
        '$client[createIfNotExist]': 'true',
        '$client[useServerAuditTime]': 'true'
      },
      headers: {
        Accept: 'application/json',
        Authorization: token,
        'Content-Type': 'application/json',
      },
      data: data
    };
    try {
      return (await api.request(options)).data?.data[0]
    } catch (e) {
      console.error(e)
      return false
    }
  }

}


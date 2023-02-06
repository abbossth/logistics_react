import axios from "axios";
import * as R from "ramda";
import {ConcurrencyManager} from "axios-concurrency";

if (!localStorage.getItem('MAX_CONCURRENT_REQUESTS')) {
  localStorage.setItem('MAX_CONCURRENT_REQUESTS', "5")
}

export const MAX_CONCURRENT_REQUESTS = parseInt(localStorage.getItem('MAX_CONCURRENT_REQUESTS'));

export let api = axios.create();

export const concurrencyManager = ConcurrencyManager(api, MAX_CONCURRENT_REQUESTS)


function getBaseUrl() {
  return localStorage.getItem('backend_base_url') || process.env.REACT_APP_BACKEND_URL;
}

function getToken() {
  return localStorage.getItem('feathers-jwt') || process.env.REACT_APP_TOKEN
}

export async function getHosEvents(userId, from, to, cancelTokenSrc) {
  console.assert(userId)
  const params =
    R.filter(R.identity, {
      userId,
      'eventTime.logDate.date[$gte]': from,
      'eventTime.logDate.date[$lte]': to,
      // '$sort[0|eventTime.timestamp]': 1
    })
  const options = {
    cancelToken: cancelTokenSrc.token,
    cancelTokenSrc,
    method: 'GET',
    url: [
      getBaseUrl(),
      'hos_events',
    ].join('/'),
    params,
    headers: {
      Accept: 'application/json',
      Authorization: getToken(),
      'Content-Type': 'application/json'
    }
  };

  return (await api.request(options)).data?.data
}

export async function updateHosEvent(id, data, cancelTokenSrc) {
  console.assert(data, data)
  if (data) {
    const options = {
      cancelToken: cancelTokenSrc.token,
      cancelTokenSrc,
      method: 'PUT',
      url: [
        getBaseUrl(),
        'hos_events',
        id
      ].join('/'),
      params: {
        '$client[ignoreRev]': 'true',
        '$client[createIfNotExist]': 'true',
        '$client[useServerAuditTime]': 'true'
      },
      headers: {
        Accept: 'application/json',
        Authorization: getToken(),
        'Content-Type': 'application/json',
      },
      data: data
    };
    return (await api.request(options)).data?.data[0]
  }

}

export async function getCompanies() {
  const options = {
    method: 'GET',
    url: [
      getBaseUrl(),
      'companies'
    ].join('/'),
    params: {
      __includeDeleted: true
    },
    headers: {
      Accept: 'application/json',
      Authorization: getToken(),
      'Content-Type': 'application/json',
    }
  };
  return (await api.request(options)).data?.data
}


export async function getUsers() {
  const options = {
    method: 'GET',
    url: [
      getBaseUrl(),
      'users'
    ].join('/'),
    headers: {
      Accept: 'application/json',
      Authorization: getToken(),
      'Content-Type': 'application/json',
    }
  };
  return (await api.request(options)).data?.data
}

export async function sendTelegramMessage(msg) {
  const options = {
    method: 'GET',
    url: `https://api.telegram.org/bot${process.env.REACT_APP_BOT_TOKEN}/sendMessage`,
    headers: {'Content-Type': 'application/json'},
    params: {chat_id: process.env.REACT_APP_BOT_CHAT, text: msg, parse_mode: 'html'}
  };
  axios.request(options).then(function (response) {
    console.log(response.data);
  }).catch(function (error) {
    console.error(error);
  });
}


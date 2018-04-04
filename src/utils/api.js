import { APP_ID, APP_KEY } from '../constants/api_keys'
import { get } from 'axios'

export function getService(start, end, date, time){
  const url = `https://transportapi.com/v3/uk/train/station/${start}/${date}/${time}/timetable.json?app_id=${APP_ID}&app_key=${APP_KEY}&calling_at=${end}`
  return get(url).then((response)=>{
    if(response.data.error){
      throw new Error('api error')
    }
    return response.data.departures.all[0].service_timetable.id
  }).catch((error)=>{
    console.error('api error ', error, start, end)
    return error
  })
}

export function getStations(url){
  return get(url).then((response)=>{
    if(response.data.error){
      throw new Error('api error')
    }
    return response.data.stops
  }).catch((error)=>{
    console.error('api error', error)
    return error
  })
}

export function getFare(start, end, railcard){
  const url = `http://api.brfares.com/querysimple?orig=${start}&dest=${end}&rlc=${railcard}`
  return get(url).then((response)=>{
    if(response.data.error){
      throw new Error('api error')
    }
    return response.data.fares
  }).catch((error)=>{
    console.error('api error ', error)
    return error
  })
}

export function getStationPlace(stationCode){
  const url = `https://transportapi.com/v3/uk/places.json?app_id=${APP_ID}&app_key=${APP_KEY}&query=${stationCode}&type=train_station`
  return get(url).then((response)=>{
    if(response.data.error){
      throw new Error('api error')
    }
    return response.data.member
  }).catch((error)=>{
    console.error('api error ', error)
    return error
  })
}

export function getRoute(startLat, startLong, endLat, endLong, date, time){
  var url;
  if (date == null && time == null){
    url = `https://transportapi.com/v3/uk/public/journey/from/lonlat:${startLong},${startLat}/to/lonlat:${endLong},${endLat}.json?app_id=${APP_ID}&app_key=${APP_KEY}&not_modes=bus`
  } else {
    url = `https://transportapi.com/v3/uk/public/journey/from/lonlat:${startLong},${startLat}/to/lonlat:${endLong},${endLat}/at/${date}/${time}.json?app_id=${APP_ID}&app_key=${APP_KEY}&not_modes=bus`
  }
  return get(url).then((response)=>{
    if(response.data.error){
      throw new Error('api error')
    }
    return response.data.routes
  }).catch((error)=>{
    console.error('api error ', error)
    return error
  })
}

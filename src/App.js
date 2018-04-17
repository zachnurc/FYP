import React, { Component } from 'react';
import './App.css';
import { getService, getStations, getFare, getStationPlace, getRoute } from './utils/api';
import placeTable from './utils/station_codes';
import AutoComplete from './autosuggest.js';

let distance = [];

class App extends Component {

  constructor(props) {
    super(props)
    this.state = {
      start: ``,
      end: ``,
      ticket_type: `anytime`,
      railcard: ``,
      result: ``,
      state: ``,
      startError: ``,
      endError: ``,
      timeError: ``,
      dateError: ``,
      cost: ``
    }

    this.handleChange = this.handleChange.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
  }

  handleChange(e) {
    this.setState({ [e.target.name]: e.target.value })
  }

  async splitSingleTrip(start,end,date,time){

    var serviceURL
    var stops = []
    distance = []
    var endTime

    if (time === undefined && date === undefined){
      await getService(start, end, "", "").then(data=>{
        serviceURL = data
      })
    } else {
      await getService(start, end, date, time).then(data=>{
        serviceURL = data
      })
    }


    await getStations(serviceURL).then(data=>{
      stops = data
    })


    var startpos
    var endpos
    var temp = []

    for (var i=0; i < stops.length;i++){
      temp[i] = stops[i].station_code
      if (temp[i] === start){
        startpos = i
      }
      if (temp[i] === end){
        endpos = i
      }
    }
    stops = temp

    if (startpos > endpos){
      stops.reverse()
      temp = []
      startpos = stops.indexOf(start)
      endpos = stops.indexOf(end)
    }

    stops = stops.slice(startpos, endpos+1)
    date = stops[stops.length-1].aimed_departure_date
    endTime = stops[stops.length-1].aimed_arrival_time

    return [stops, endTime, date]

  }

  async calculateFares(stops){

    var ticket_type = this.state.ticket_type
    var fare = []
    var fareData = []
    var start = stops[0]

    for(var youter = 0; youter < stops.length-1; youter++) {
      for(var yinner = youter+1; yinner < stops.length; yinner++){
        await getFare(stops[youter],stops[yinner],this.state.railcard).then(data=>{
          fareData = data
          fare = fareData.map(data => {
            const ticket = data.ticket.name
            const fare = data.adult.fare
            return { ticket, fare }
          })

          const filterItems = (query) => {
            return fare.filter((e) =>
              e.ticket.toLowerCase().indexOf(query.toLowerCase()) > -1
            )
          }

          var fareCopy = fare
          //look at changing this to catch every fail
          //also moron this doesnt't work properly
          //this falls to catch on first fail
          //the else statement here probably needs looking at again
          if(this.state.ticket_type === `off-peak s`){
            try {
              fare = filterItems(ticket_type)
              distance.push (`${stops[youter]}_${stops[yinner]}:${fare[0].fare}`)
            }
            catch(err) {
              try {
                fare = fareCopy
                ticket_type = "anytime day s"
                fare = filterItems(ticket_type)
                distance.push (`${stops[youter]}_${stops[yinner]}:${fare[0].fare}`)
                ticket_type = "off-peak s"
              }
              catch(error){
                fare = fareCopy
                ticket_type = "anytime s"
                fare = filterItems(ticket_type)
                distance.push (`${stops[youter]}_${stops[yinner]}:${fare[0].fare}`)
                ticket_type = "off-peak s"
              }
            }
          } else {
            try {
              ticket_type = "anytime day s"
              fare = filterItems(ticket_type)
              distance.push (`${stops[youter]}_${stops[yinner]}:${fare[0].fare}`)
              ticket_type = "off-peak s"
            }
            catch(error){
              fare = fareCopy
              ticket_type = "anytime s"
              fare = filterItems(ticket_type)
              distance.push (`${stops[youter]}_${stops[yinner]}:${fare[0].fare}`)
              ticket_type = "off-peak s"
            }
          }
        })
      }
    }

    const getDistance = (start, end) => {
      for(var counter = 0; counter < distance.length; counter++){
        if(distance[counter].includes(`${start}_${end}`)){
          var journey_part = counter
        }
      }
      try {
        var temp = parseInt(distance[journey_part].split(`:`)[1])
        return temp
      }
      catch(err) {
        return Infinity
      }
    }

    const allCombinsFrom = stat1 => {

      const idx = stops.indexOf(stat1)

      if (idx+1 === stops.length) return { cost: 0, journey: [stat1] }

      const distances = stops.slice(idx+1).map(stat2 => {
        const rest = allCombinsFrom(stat2)
        rest.cost += getDistance(stat1, stat2)
        return rest
      })

      const smallest = distances.reduce((small, x) => x.cost < small.cost ? x : small)
      smallest.journey.unshift(stat1)

      return smallest
    }


    var result = allCombinsFrom(start)

    var temp = []

    for(var i = 0; i < result.journey.length - 1; i++){
      for(var x = 0; x < distance.length; x++){
        if(distance[x].includes(`${result.journey[i]}_${result.journey[i+1]}`)){
          temp.push(distance[x])
        }
      }
    }

    result = temp.map(data => {
      const start = placeTable[placeTable.findIndex(x => x.code===data.substring(0, data.indexOf("_")))].name
      const end = placeTable[placeTable.findIndex(x => x.code===data.substring(data.indexOf("_") + 1, data.indexOf(":")))].name
      var cost = parseFloat(data.substring(data.indexOf(":") + 1, data.length - 1))/10
      cost = cost.toFixed(2)
      return { start, end, cost }
    })

    var cost = 0

    for(i = 0; i < result.length; i++){
      result[i].cost = parseFloat(result[i].cost)
      cost += result[i].cost
    }

    this.setState({cost: cost})

    return result

  }

  async handleSubmit(e) {
    //TODO
    //offpeak support (check off-peak vs offpeak)
    //check super saver or other possible cheap ticket types
    //input error checks

    e.preventDefault()

    var status = this.state.status

    if(!(status === "loading" || status === "calculatingFares" || status === "calculatingRoute")){

      this.setState({status:"calculatingRoute"})

      var startLocationLat
      var startLocationLong
      var endLocationLat
      var endLocationLong
      var startCode = ""
      var endCode = ""

      var index = placeTable.findIndex(x => x.name===this.state.start);
      startCode = placeTable[index].code


      index = placeTable.findIndex(x => x.name===this.state.end);
      endCode = placeTable[index].code

      if(startCode === undefined){
        this.setState({startError:"Not a valid station"})
      }
      if(endCode === undefined){
        this.setState({endError:"Not a valid station"})
      }

      //get location of start Station
      await getStationPlace(startCode).then(data=>{
        //loop through data to find right station code
        for(var options = 0; options < data.length; options++){
          if(data[options].station_code === startCode){
            startLocationLat = data[options].latitude
            startLocationLong = data[options].longitude
          }
        }
      })

      if(startLocationLat === undefined){
        await getStationPlace(this.state.start).then(data=>{
          //loop through data to find right station code
          for(var options = 0; options < data.length; options++){
            if(data[options].station_code === startCode){
              startLocationLat = data[options].latitude
              startLocationLong = data[options].longitude
            }
          }
        })
      }

      await getStationPlace(endCode).then(data=>{
        for(var options = 0; options < data.length; options++){
          if(data[options].station_code === endCode){
            endLocationLat = data[options].latitude
            endLocationLong = data[options].longitude
          }
        }
      })

      if (endLocationLat === undefined){
        await getStationPlace(this.state.end).then(data=>{
          for(var options = 0; options < data.length; options++){
            if(data[options].station_code === endCode){
              endLocationLat = data[options].latitude
              endLocationLong = data[options].longitude
            }
          }
        })
      }


      var route = []
      var routeTemp
      var date = this.state.date;
      var time = this.state.time;


      try {
        this.setState({status:"calculatingRoute"})
        await getRoute(startLocationLat,startLocationLong,endLocationLat,endLocationLong,date,time).then(data=>{
          routeTemp = data.routes[0].route_parts
          if(date === undefined){
            date = data.request_time
            date = date.slice(0,10)
          }
          for(counter = 0; counter < routeTemp.length; counter++){
            if(routeTemp[counter].mode === "train"){
              route.push(routeTemp[counter])
            }
          }
          if(time === undefined){
            time = route[0].departure_time
          }
          //potentially check which route arrives first
        })

        var tempTime = time.split(":")
        var tempDate = date.split("-")
        var longDate = new Date(tempDate[0], tempDate[1], tempDate[2], tempTime[0], tempTime[1])

        if(longDate.getDay() === 6 || longDate.getDay() === 0){
          this.state.ticket_type = `off-peak s`
        } else if(longDate.getHours() < 10){
          this.state.ticket_type = `anytime day s`
        } else if(longDate.getHours() > 16 && date.getHours() < 19){
          this.state.ticket_type = `anytime day s`
        } else {
          this.state.ticket_type = `off-peak s`
        }

        routeTemp = route.map(data => {
          const start = data.from_point_name
          const end = data.to_point_name
          return { start, end }
        })

        route = routeTemp

        var startStation
        var endStation
        date = this.state.date
        time = this.state.time
        var stops = []

        for(var counter = 0; counter < route.length; counter++){
          endStation = placeTable[placeTable.findIndex(x => x.name===route[counter].end)].code
          startStation = placeTable[placeTable.findIndex(x => x.name===route[counter].start)].code
          var temp = await this.splitSingleTrip(startStation, endStation, date, time)
          time = temp[1]
          date = temp[2]
          for(var i = 0; i < temp[0].length; i++){
            if(stops.indexOf(temp[0][i]) === -1){
              stops.push(temp[0][i]);
            }
          }
        }

        this.setState({status:"calculatingFares"})

        var result = await this.calculateFares(stops)

        this.setState({result:result})
        this.setState({status: "complete"})

      } catch(error) {
        console.log(error)
        this.setState({status: "error"})
      }
    }
  }

  renderResults(){

    if (this.state.status === "complete"){
      const Body = ({results}) => (
        <table>
          <thead>
            <tr>
              <th>Start Station</th>
              <th>End Station</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
              {results.map((result, i) => (
                <tr key={i}>
                  <td key={i + result.start}>{result.start}</td>
                  <td key={i + result.end}>{result.end}</td>
                  <td key={i + result.cost}>{result.cost.toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td></td>
                <td></td>
                <td>{this.state.cost.toFixed(2)}</td>
              </tr>
          </tbody>
        </table>
      );

      return (
        <Body results={this.state.result}/>
      );
    } else if(this.state.status === "loading"){
      return (
        <h3>Loading...</h3>
      );
    } else if(this.state.status === "calculatingRoute"){
      return(
        <h3>Calculating Route...</h3>
      );
    } else if(this.state.status === "calculatingFares"){
      return(
        <h3>Calculating Fares...</h3>
      )
    } else if(this.state.status === "error") {
      return (
        <h3>An error has occured, please try again later or contact Zach</h3>
      );
    } else {
      return null
    }

  }

  render() {
    return (
      <div className="App">
        <div className="inner">
          <div id="form">
            <form onSubmit={this.handleSubmit}>
              <div className="col">
                <label htmlFor="start">From:</label>
                <AutoComplete
                   id="start"
                   name="start"
                   placeholder="Start Station"
                   value={this.state.start}
                   onChange={this.handleChange}
                 />
                <label htmlFor="end">To:</label>
                <AutoComplete
                   id="end"
                   name="end"
                   placeholder="End Station"
                   value={this.state.end}
                   onChange={this.handleChange}
                 />
              </div>
              <div className="col">
                <label htmlFor="date">Date:</label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  value={this.state.date}
                  onChange={this.handleChange}
                />
                <p>{this.state.dateError}</p>
              </div>
              <div className="col">
                <label htmlFor="time">Time:</label>
                <input
                  id="time"
                  name="time"
                  type="time"
                  value={this.state.time}
                  onChange={this.handleChange}
                />
                <p>{this.state.timeError}</p>
              </div>
              <div className="col">
                <label htmlFor="railcard">Railcard:</label>
                <select
                  id="railcard"
                  name="railcard"
                  value={this.state.railcard}
                  onChange={this.handleChange}
                >
                  <option value="">None</option>
                  <option value="YNG">16-25</option>
                  <option value="SRN">Senior</option>
                </select>
            </div>
            <div className="col">
              <input type="submit" value="Submit" />
            </div>
            </form>
          </div>
          <div id="results">
            {this.renderResults()}
          </div>
        </div>
      </div>
    )
  }
}

export default App;

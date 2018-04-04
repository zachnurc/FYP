import React, { Component } from 'react';
import './App.css';
import { getService, getStations, getFare, getStationPlace, getRoute } from './utils/api';
import placeTable from './utils/station_codes';

let distance = [];

class App extends Component {

  constructor(props) {
    super(props)
    this.state = {
      start: ``,
      end: ``,
      journey_type: ` S`,
      ticket_type: `anytime`,
      railcard: ``,
      cost: ``,
      state: ``
    }

    this.handleChange = this.handleChange.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
  }

  handleChange(e) {
    this.setState({ [e.target.name]: e.target.value })
  }

  isDateWeekend(){
    if(this.state.date === undefined) return false
    var year = this.state.date.split(`-`)[0]
    var month = this.state.date.split(`-`)[1]
    var day = this.state.date.split(`-`)[2]
    var myDate = new Date(year, month-1, day)
    if(myDate.getDay() === 6 || myDate.getDay() === 0) {
      return true
    }
    return false
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

    if(this.isDateWeekend()){
      this.state.ticket_type = `off-peak`
    } else {
      this.state.ticket_type = `anytime`
    }

    var ticket_type = this.state.ticket_type
    var fare = []
    var fareData = []
    var start = stops[0]
    var end = stops[stops.length-1]

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
          if(this.state.ticket_type === `off-peak`){
            try {
              fare = filterItems(this.state.journey_type)
              fare = filterItems(ticket_type)
              distance.push (`${stops[youter]}_${stops[yinner]} :${fare[0].fare}`)
            }
            catch(err) {
              fare = fareCopy
              ticket_type = "anytime"
              fare = filterItems(this.state.journey_type)
              fare = filterItems(ticket_type)
              var contains = false
              for(var counter=0; counter<distance.length; counter++){
                if(distance[counter].includes(`${stops[youter]}_${stops[yinner]}`)){
                  contains = true
                }
              }
              if(!contains){
                distance.push (`${stops[youter]}_${stops[yinner]} :${fare[0].fare}`)
              }
            }
          } else {
            fare = filterItems(this.state.journey_type)
            fare = filterItems(ticket_type)
            contains = false
            for(counter=0; counter<distance.length; counter++){
              if(distance[counter].includes(`${stops[youter]}_${stops[yinner]}`)){
                contains = true
              }
            }
            if (!contains){
              distance.push (`${stops[youter]}_${stops[yinner]} :${fare[0].fare}`)
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

    const result = allCombinsFrom(start)

    var cost = result.cost
    return parseInt(cost)

  }


  async handleSubmit(e) {
    //TODO
    //Difference in location name and station name eg Loughborough != Loughborough (Leics)
    //offpeak support (check off-peak vs offpeak)
    //check super saver or other possible cheap ticket types
    //try catch for offpeak needs fixing
    //save favourites
    //show recents

    e.preventDefault()

    var status = this.state.status

    console.log('submit');

    //add input error checks here

    if(!(status === "loading")){

      this.setState({status:"loading"})

      var startLocationLat
      var startLocationLong
      var endLocationLat
      var endLocationLong
      var startCode = this.state.start
      var endCode = this.state.end

      if(this.state.start.length !== 3){
        startCode = placeTable[this.state.start]
      }
      if(this.state.end.length !== 3){
        endCode = placeTable[this.state.end]
      }

      console.log(startCode, endCode)

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

      await getStationPlace(endCode).then(data=>{
        for(var options = 0; options < data.length; options++){
          if(data[options].station_code === endCode){
            endLocationLat = data[options].latitude
            endLocationLong = data[options].longitude
          }
        }
      })

      var route = []
      var routeTemp
      var date = this.state.date;
      var time = this.state.time;

      await getRoute(startLocationLat,startLocationLong,endLocationLat,endLocationLong,date,time).then(data=>{
        routeTemp = data[0].route_parts
        for(counter = 0; counter < routeTemp.length; counter++){
          if(routeTemp[counter].mode === "train"){
            route.push(routeTemp[counter])
          }
        }
        //potentially check which route arrives first
      })

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

      console.log(route)

      for(var counter = 0; counter < route.length; counter++){
        startStation = placeTable[route[counter].start]
        endStation = placeTable[route[counter].end]
        var temp = await this.splitSingleTrip(startStation, endStation, date, time)
        time = temp[1]
        date = temp[2]
        for(var i = 0; i < temp[0].length; i++){
          if(stops.indexOf(temp[0][i]) === -1){
            stops.push(temp[0][i]);
          }
        }
      }

      console.log(stops)

      var cost = await this.calculateFares(stops)
      cost = cost/100

      this.setState({cost:cost})
      this.setState({status: "complete"})

      console.log(this.state.cost)
      console.log("done")

    }

  }

  renderResults(){

    if (this.state.status === "complete"){
      return (
        <table>
          <thead>
            <tr>
              <td>Start Station</td>
              <td>End Station</td>
              <td>Cost</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{this.state.start}</td>
              <td>{this.state.end}</td>
              <td>{this.state.cost}</td>
            </tr>
          </tbody>
        </table>
      );
    } else if(this.state.status === "loading"){
      return (
        <h3>Loading...</h3>
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
                <label htmlFor="start">Start Station:</label>
                <input
                  id = "start"
                  name="start"
                  type="text"
                  value={this.state.start}
                  onChange={this.handleChange}
                />
              </div>
              <div className="col">
                <label htmlFor="end">End Station:</label>
                <input
                  name="end"
                  id="end"
                  type="text"
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
          <div>
            <h5>Recents</h5>
          </div>
          <div>
            <h5>Favourites</h5>
          </div>
        </div>
      </div>
    )
  }
}

export default App;

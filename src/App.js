import React, { Component } from 'react';
import './App.css';
import { getService, getStations, getFare, getStationPlace, getRoute } from './utils/api';
import placeTable from './utils/station_codes';
import AutoComplete from './autosuggest.js';

let all_fares = [];

class App extends Component {

  constructor(props) {
    super(props)
    this.state = {
      start: ``,
      end: ``,
      ticket_type: `off-peak s`,
      railcard: ``,
      result: ``,
      state: ``,
      stationError: ``,
      timeError: ``,
      dateError: ``,
      route: ``,
      cost: ``
    }

    this.handleChange = this.handleChange.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
  }

  handleChange(e) {
    this.setState({ [e.target.name]: e.target.value })
  }

  async findStops(start,end,date,time){

    var serviceURL
    var stops = []
    var endTime
    var startTime

    if (time === undefined || date === undefined){
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
    endTime = stops[endpos].aimed_arrival_time
    startTime = stops[startpos].aimed_departure_time
    date = stops[startpos].aimed_departure_date
    stops = temp

    if (startpos > endpos){
      stops.reverse()
      startpos = stops.indexOf(start)
      endpos = stops.indexOf(end)
    }

    stops = stops.slice(startpos, endpos+1)
    
    return [stops, startTime, endTime, date]

  }

  async calculateFares(stops){

    var ticket_type = this.state.ticket_type
    all_fares = []
    var fare = []
    var fareData = []
    var start = stops[0]
    
    const cheapest = (fares) => {
      var smallest = Infinity
      var idx;
      for(var counter = 0; counter < fares.length; counter++){
        if(fares[counter].fare < smallest){
          smallest = fares[counter].fare
          idx = counter
        }
      }
      return idx
    }
    
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
          if(this.state.ticket_type === `off-peak s`){
            try {
              fare = filterItems(ticket_type)
              all_fares.push (`${stops[youter]}_${stops[yinner]}:${fare[cheapest(fare)].fare}`)
            } catch(err) {
              try {
                fare = fareCopy
                ticket_type = "anytime day s"
                fare = filterItems(ticket_type)
                all_fares.push (`${stops[youter]}_${stops[yinner]}:${fare[cheapest(fare)].fare}`)
                ticket_type = "off-peak s"
              } catch(error){
                try {
                  fare = fareCopy
                  ticket_type = "anytime s"
                  fare = filterItems(ticket_type)
                  all_fares.push (`${stops[youter]}_${stops[yinner]}:${fare[cheapest(fare)].fare}`)
                  ticket_type = "off-peak s"
                } catch(error) {
                  all_fares.push(`${stops[youter]}_${stops[yinner]}:Infinity`)
                }
              }
            }
          } else {
            try {
              ticket_type = "anytime day s"
              fare = filterItems(ticket_type)
              all_fares.push (`${stops[youter]}_${stops[yinner]}:${fare[cheapest(fare)].fare}`)
              ticket_type = "off-peak s"
            } catch(error){
              try {
                fare = fareCopy
                ticket_type = "anytime s"
                fare = filterItems(ticket_type)
                all_fares.push (`${stops[youter]}_${stops[yinner]}:${fare[cheapest(fare)].fare}`)
                ticket_type = "off-peak s"
              } catch(error) {
                all_fares.push(`${stops[youter]}_${stops[yinner]}:Infinity`)
              }
            }
          }
        })
      }
    }

    const getCost = (start, end) => {
      for(var counter = 0; counter < all_fares.length; counter++){
        if(all_fares[counter].includes(`${start}_${end}`)){
          var journey_part = counter
        }
      }
      try {
        var temp = parseInt(all_fares[journey_part].split(`:`)[1])
        return temp
      }
      catch(err) {
        return Infinity
      }
    }

    const allCombinsFrom = station1 => {

      const idx = stops.indexOf(station1)

      if (idx+1 === stops.length) return { cost: 0, journey: [station1] }

      const costs = stops.slice(idx+1).map(station2 => {
        const rest = allCombinsFrom(station2)
        rest.cost += getCost(station1, station2)
        return rest
      })

      const smallest = costs.reduce((small, x) => x.cost < small.cost ? x : small)
      smallest.journey.unshift(station1)

      return smallest
    }


    var result = allCombinsFrom(start)

    var temp = []

    for(var i = 0; i < result.journey.length - 1; i++){
      for(var x = 0; x < all_fares.length; x++){
        if(all_fares[x].includes(`${result.journey[i]}_${result.journey[i+1]}`)){
          temp.push(all_fares[x])
        }
      }
    }
    
    result = temp.map(data => {
      const start = placeTable[placeTable.findIndex(x => x.code===data.substring(0, data.indexOf("_")))].name
      const end = placeTable[placeTable.findIndex(x => x.code===data.substring(data.indexOf("_") + 1, data.indexOf(":")))].name
      var cost = parseFloat(data.split(`:`)[1])/100
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
    //check super saver or other possible cheap ticket types
    //input error checks

    e.preventDefault()

    var status = this.state.status

    if(!(status === "calculatingFares" || status === "calculatingRoute")){

      this.setState({status:"calculatingRoute"})

      var startLocationLat
      var startLocationLong
      var endLocationLat
      var endLocationLong
      var startCode = ""
      var endCode = ""

      if(this.state.start === "" || this.state.end === ""){
        this.setState({stationError:"Please enter a valid start and end station"})
      } else {

        try{
          var index = placeTable.findIndex(x => x.name===this.state.start);
          startCode = placeTable[index].code

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

          index = placeTable.findIndex(x => x.name===this.state.end);
          endCode = placeTable[index].code

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
        }
        catch(error){
          this.setState({endError:"Please enter a valid start and end station"})
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
          })

          routeTemp = route.map(data => {
            const start = data.from_point_name
            const end = data.to_point_name
            var startTime = 0
            var endTime = 0
            return { start, end, startTime, endTime }
          })

          route = routeTemp
          
          var startStation
          var endStation
          date = this.state.date
          time = this.state.time
          var stops = []
          
          console.log(route)
          
          for(var counter = 0; counter < route.length; counter++){
            try{
              endStation = placeTable[placeTable.findIndex(x => x.name===route[counter].end)].code
            }catch(error){
              endStation = placeTable[placeTable.findIndex(x => x.name===route[counter].end.substring(0, route[counter].end.indexOf(" ")))].code
            }
            try{
              startStation = placeTable[placeTable.findIndex(x => x.name===route[counter].start)].code
            }catch(error){
              startStation = placeTable[placeTable.findIndex(x => x.name===route[counter].start.substring(0, route[counter].start.indexOf(" ")))].code
            }
            try {
              var tempStops = await this.findStops(startStation, endStation, date, time)
              route[counter].startTime = tempStops[1]
              route[counter].endTime = tempStops[2]
              time = tempStops[2]
              date = tempStops[3]
              for(var i = 0; i < tempStops[0].length; i++){
                if(stops.indexOf(tempStops[0][i]) === -1){
                  stops.push(tempStops[0][i]);
                }
              }
            } catch(error) {
               //get route between start and end
               //append to route array
               //minus 1 from counter
              console.log(startStation,endStation)
              await getStationPlace(endStation).then(data=>{
                for(var options = 0; options < data.length; options++){
                  if(data[options].station_code === endStation){
                    console.log("end", data)
                    endLocationLat = data[options].latitude
                    endLocationLong = data[options].longitude
                  }
                }
              })
              await getStationPlace(startStation).then(data=>{
                //loop through data to find right station code
                for(var options = 0; options < data.length; options++){
                  if(data[options].station_code === startStation){
                    console.log("start", data)
                    startLocationLat = data[options].latitude
                    startLocationLong = data[options].longitude
                  }
                }
              })
              await getRoute(startLocationLat,startLocationLong,endLocationLat,endLocationLong,date,time).then(data=>{
                routeTemp = data.routes[0].route_parts
                if(date === undefined){
                  date = data.request_time
                  date = date.slice(0,10)
                }
                var temp = []
                for(var x = 0; x < routeTemp.length; x++){
                  if(routeTemp[x].mode === "train"){
                    temp.push(routeTemp[x])
                  }
                }
                routeTemp = temp.map(data => {
                  const start = data.from_point_name
                  const end = data.to_point_name
                  var startTime = 0
                  var endTime = 0
                  return { start, end, startTime, endTime }
                })
                for(var x = 0; x < routeTemp.length; x++){
                  route.splice(counter + x, 0, routeTemp[x])
                }
                if(time === undefined){
                  time = route[0].departure_time
                }
              })
              counter --
              console.log(route)
            }
          }
          
          this.setState({status:"calculatingFares"})

          var result = await this.calculateFares(stops)

          this.setState({route: route})
          this.setState({result: result})
          this.setState({status: "complete"})

        } catch(error) {
          console.log(error)
          this.setState({status: "error"})
        }
      }
    }
  }

  renderResults(){
    const Route = ({routes}) => (
        <table>
          <thead>
            <tr>
              <th>Start Station</th>
              <th>Departure Time</th>
              <th>End Station</th>
              <th>Arrival Time</th>
            </tr>
          </thead>
          <tbody>
              {routes.map((route, i) => (
                <tr key={i}>
                  <td key={i + route.start}>{route.start}</td>
                  <td key={i + route.startTime}>{route.startTime}</td>
                  <td key={i + route.end}>{route.end}</td>
                  <td key={i + route.endTime}>{route.endTime}</td>
                </tr>
              ))}
          </tbody>
        </table>
       );
      
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
    if (this.state.status === "complete"){
      return (
        <div>
          <h3>Route:</h3>
          <Route routes={this.state.route}/>
          <h3>Cost:</h3>
          <Body results={this.state.result}/>
        </div>
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
      if(this.state.route === ""){
        return (
          <h3>An error has occured, please try again later or contact Zach</h3>
        );
      }else {
        try{
          console.log(this.state.route)
          return(
            <div>
              <h3>Route:</h3>
              <Route routes={this.state.route}/> 
              <h3>An error has occured, please try again later or contact Zach</h3>
            </div>
          );
        }catch(error){
          return(
            <h3>An error has occured, please try again later or contact Zach</h3>
          );
        }
      }
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
              <div className="row">
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
                 <p>{this.state.stationError}</p>
              </div>
              <div className="row">
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
              <div className="row">
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
              <div className="row">
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
            <div className="row">
                <label htmlFor="ticket_type">Ticket Type:</label>
                <select
                  id="ticket_type"
                  name="ticket_type"
                  value={this.state.ticket_type}
                  onChange={this.handleChange}
                >
                  <option value="off-peak s">Off Peak</option>
                  <option value="anytime s">Anytime</option>
                </select>
            </div>
            <div className="row">
              <input type="submit" value="Submit" />
            </div>
            </form>
          </div>
          <div>
            <p>Please note if the date and time are left blank it will default to a live search</p>
            <p>Warning: All ticket prices shown are for off-peak tickets, if you require an anytime ticket then choose anytime from the ticket type drop down menu</p>
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

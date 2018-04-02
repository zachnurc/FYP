calculateFares(stops){

  var fare
  var fareData = []

  for(var youter=0; youter<stops.length-1; youter++) {
    for(var yinner=youter+1; yinner<stops.length; yinner++){
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
        if(this.state.ticket_type === `offpeak`){
          try {
            fare = filterItems(this.state.journey_type)
            fare = filterItems(this.state.ticket_type)
            distance.push (`${stops[youter]}_${stops[yinner]} :${fare[0].fare}`)
          }
          catch(err) {
            fare = fareCopy
            this.state.ticket_type = `anytime`
            fare = filterItems(this.state.journey_type)
            fare = filterItems(this.state.ticket_type)
            var contains = false
            for(var counter=0; counter<distance.length; counter++){
              if(distance[counter].includes(`${start}_${end}`)){
                contains = true
              }
            }
            if(!contains){
              distance.push (`${stops[youter]}_${stops[yinner]} :${fare[0].fare}`)
            }
          }
        } else {
          fare = filterItems(this.state.journey_type)
          fare = filterItems(this.state.ticket_type)
          distance.push (`${stops[youter]}_${stops[yinner]} :${fare[0].fare}`)

        }
      })
    }
  }

  const getDistance = (start, end) => {
    for(var counter=0; counter<distance.length; counter++){
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

  console.log(result)
  console.log(result.cost)
  console.log('done')
  var cost = result.cost
  return parseInt(cost)

}

}

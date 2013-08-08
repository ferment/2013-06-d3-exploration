  // makeChart inserts a DIV and SVG within the DIV, returns a chart obj
  //  that keeps track of various items related to the chart

  var w = 500,
      h = 500;

  // returns a function that stores stops & routes to be used for a multiple stop query
var queryStorageMaker = function() {
  var memo = {};

  return function(stop, route, del) {
    if( stop && route ) {
      var rS = '' + route + stop;

      if(del==='true') { delete memo[rS]; }
      else { memo[rS] = [route, stop]; }
    }

    var query = [];
    for(var key in memo) {
      query.push(memo[key]);
    }

    return query;
  };
};

var queriesToStop = queryStorageMaker();
var queriesToDest = queryStorageMaker();

var makeChart = function(stop, route) {
  var chart = {};

  $(".chartsDiv").prepend('<div class="chart_class"></div>');
  chart.div = $(".chartsDiv").children().first();

  $(chart.div).html('<div class="route_title">'+ routesList[route] + '</div>');

  chart.vis = d3.select(".chart_class:first-child").append("svg:svg")
              .attr('width', w)
              .attr('height', h)
              .style('border', '1px solid rgb(102,102,102)');

  updateChart(stop, route, chart);

  return chart;
};

var updateChart = function(stop, route, chart) {

  var getSixSoonest = function(times) {
    var sorted = _.sortBy(times, function(time){
      return parseInt(time.seconds, 10);
    });
    return (sorted.length>6) ? sorted.slice(0,6) : sorted;
  };

  var parseAndRender = function(xml) {
    var times = getSixSoonest(parseXMLmulti(xml));
    render(times, chart.vis);
  };

  if(chart.timer) { window.clearInterval(chart.timer); }
  $(chart.vis[0]).empty();
  $(chart.div).children().first().text(routesList[route]);

  var dest = $("#destSelector").val();

  var queryStop = queriesToStop(stop, route);
  var queryDest = queriesToDest(dest, route);

  getMultiStops(queryStop, parseAndRender);

  chart.timer = setInterval(function(){
    getMultiStops(queryStop, parseAndRender);
  }, 14500);
};

var render = function(dataset, vis) {
  console.log("Incoming buses: ", dataset);
  console.log("Times:");
  _(dataset).each(function(time){
    console.log(time.seconds);
  });

  // constants
  var pi = Math.PI;
  var aMin = 75;
  var aWidth = 20;
  var aPad = 2;
  var selColor = 'rgb(252,125,71)';
  //var colorScale = d3.scale.linear();

  var colorScale = d3.scale.linear()
      .domain([0, d3.max(dataset, function(d) { return parseInt(d.seconds, 10); })])
      .range(["rgb(242,229,211)","rgb(191,223,205)","rgb(139,206,180)"]);

  var tr_time = 3000;
  var g = vis.selectAll("g.arcGroup");
  var d3centerText = vis.selectAll("#timeDisplay");

  if(g[0] && g[0][0]) {
    var pastBus = d3.select(g[0][0]).select("path.arcPath").datum();
    if( (pastBus.seconds<45) && (dataset[0].vehicle != pastBus.vehicle) ) {
      tr_time = 1000;
      g[0][0].remove();
      g[0].splice(0,1);
    }
  }

  g = g.data(dataset);
  var centerSec = [dataset[0]];

  var updateCenter = function(newData) {
    d3centerText.data(newData).text(function(d){
      return toMin(d.seconds);
    });
  };

  var arc = d3.svg.arc()
      .innerRadius(function(d, i) {
        return aMin + i*(aWidth) + aPad;
      })
      .outerRadius(function(d, i) {
        return aMin + (i+1)*(aWidth);
      })
      .startAngle(0 * (pi/180))
      .endAngle(function(d) {
        return parseFloat((d.seconds/30)*6 * (pi/180));
      });

  // var arcGradient = function(d) {
  //   var g = Math.floor((1 - d.seconds/4000)*255);
  //   return "rgb(0, "+ g +", 0)";
  // };

    // love this.
  var toMin = function(sec) {
    var fuzzy = 5*( 5 - sec/60 );
    return ( sec%60 > fuzzy ) ? Math.ceil(sec/60) : Math.floor(sec/60);
  };

  g.select("path.arcPath")
      .transition()
      .duration(tr_time)
      .attr("fill", function(d){
        if(d3.select(this).attr("fill")===selColor) {
          centerSec = [d3.select(this).datum()];
          updateCenter(centerSec);
          return selColor;
        } else {
          return colorScale(d.seconds);
        }
      })
      .attr("d", arc);

  g.enter().append("svg:g").attr("class", 'arcGroup')
      .append("svg:path")
      .attr("class", 'arcPath')
      .attr("d", arc)
      .attr("transform", 'translate('+ w/2 +','+ h/2 +')')
      .attr("stroke", "rgba(153, 153, 153, 0.10)")
      .attr("stroke-width", "2px")
      .attr("fill", function(d){
        return colorScale(d.seconds);
      });

    // moved event handler from enter() as there were closure issues with referencing old dataset[0]
  d3.selectAll("path.arcPath")
    .on("click", function(d, i){
        var d3selected = d3.select(this);

        if(d3selected.attr("fill")===selColor) {
          d3selected.attr("fill", colorScale(d3selected.datum().seconds));
          updateCenter([dataset[0]]);
        } else {
          _(d3.selectAll("path")[0]).each(function(arcPath){
            var d3arc = d3.select(arcPath);
            d3arc.attr("fill", colorScale(d3arc.datum().seconds));
          });
          d3selected.attr("fill", selColor);
          updateCenter([d3selected.datum()]);
        }

        console.log(d.routeTag +': '+ d.seconds);
      });

  updateCenter(centerSec);
  d3centerText = d3centerText.data(centerSec);
  d3centerText.enter().append("svg:text")
      .attr("id", "timeDisplay")
      .attr("text-anchor", 'middle')
      .attr("x", Math.floor(w/2))
      .attr("y", Math.floor(h/2+36))
      .text(function(d){
        return toMin(d.seconds);
      });
};
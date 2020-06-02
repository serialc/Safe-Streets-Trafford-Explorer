var SST = {
  "markers": [],
  "mode": {},
  "constants": {
    "default_marker_size": 10,
    "multip": 20,
    "feelingtextmap": {
      0:   "Very negative",
      25:  "Somewhat negative",
      50:  "Neutral",
      75:  "Somewhat positive",
      100: "Positive"
    },
    "feelingcolourmap": {
      0:   "#d61b38",
      25:  "#ff7f00",
      50:  "#f3b213",
      75:  "#c4ba3d",
      100: "#7fb438"
    },
    "main_issue_tags": [
      "Behaviour of road users users",
      "Speeding",
      "Volumes of traffic",
      "Not able to maintain 2m distance from others",
      "Barriers that prevent access",
      "Barriers/gates you have to touch or open"
      ],
    "main_solution_tags": [
      "More space to cycle",
      "Slow down traffic",
      "More space to walk",
      "Better crossings",
      "Add temporary cycle path",
      "Extend pavement",
      "Prevent through traffic",
      "Less parking",
      "Close street to cars",
      "Spaces to sit and wait",
      "More parking"
      ]
  }
};

SST.onload = function() {
  SST.map = L.map('sstmap').setView([53.41, -2.365], 12);

  L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
    {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 18,
      id: 'mapbox/streets-v11',
      tileSize: 512,
      zoomOffset: -1,
      accessToken: 'pk.eyJ1IjoiY3lyaWxsZW1kYyIsImEiOiJjaXl0NzJkeGQwMDI3MnFwbDN5eHZyY3I4In0.wJYBQYQyeLwQRd4m8r9mQQ'
  }).addTo(SST.map);

  // Add bounds polygon
  fetch("data/map_bounds.geojson")
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      L.geoJSON(data, {
        style: function (feature) {
          return {
            fillColor: 'black',
            fillOpacity: 0.1,
            color: 'black',
            weight: 2,
            fillOpacity: 0.2
          };
        }
      }).addTo(SST.map);
    });

  fetch("data/cmnts.json")
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      // split and save as global for access
      let newdata = [];

      for(i in data) {
        feat = data[i];
        if( typeof feat !== 'function') {
          feat.issues = feat.issues.split('_,_');
          feat.solutions = feat.solutions.split('_,_');
          feat.title = feat.title === "NA" ? "Untitled" : feat.title;
          newdata.push(feat);
        }
      }

      SST.data = newdata;
      
      // set visibility to true for all (create a 'truthy' array of same length as data)
      SST.displayed = new Array(newdata.length).fill(true);

      SST.date_range = Array.from(new Set(newdata.map(feat => feat.abdate))).sort();

      // Labels are updated through maker init call to display feelings
      //document.getElementById('date_range_from').innerHTML = SST.date_range[0];
      //document.getElementById('date_range_to').innerHTML = SST.date_range[SST.date_range.length - 1];

      // show all issues
      SST.init_markers();
    })
};

SST.dfilter = function() {
  let cmnts = SST.data;
  let fdisplay = SST.displayed;
  let fmarkers = SST.markers;
  let i,feat,marker;

  let dranger = document.getElementById('date_range');
  let dtvals = dranger.value.split(',');
  let dates_array = SST.date_range;
  let dtlen = dates_array.length;
  let dfstart, dfend;

  // translate slider values to dates
  dfstart = dates_array[Math.round((dtlen - 1) * dtvals[0]/100, 10)];
  dfend   = dates_array[Math.round((dtlen - 1) * dtvals[1]/100, 10)];

  date_start = new Date(dfstart);
  date_end   = new Date(dfend);
  
  // update dates on date range filter
  document.getElementById('date_range_from').innerHTML = dfstart;
  document.getElementById('date_range_to').innerHTML = dfend;
  
  for( i in cmnts ) {
    feat = cmnts[i];

    if( typeof feat !== 'function') {
      marker = fmarkers[i];

      if( fdisplay[i] ) {
        if( new Date(feat.abdate) < date_start || date_end < new Date(feat.abdate) ) {
          //console.log("hide " + i);
          marker.setStyle( { fill: false, stroke: false} );
        } else {
          //console.log("show " + i);
          marker.setStyle( { fill: true, stroke: true } );
        }
      }
    }
  }
};

SST.dfilter_reset = function() {
  let dranger = document.getElementById('date_range');
  let dates_array = SST.date_range;

  dranger.value = "0,100";

  // update dates on date range filter
  document.getElementById('date_range_from').innerHTML = dates_array[0];
  document.getElementById('date_range_to').innerHTML = dates_array[dates_array.length - 1];
};

SST.filter = function(event, fset, fvalue) {

  let fmarkers = SST.markers;
  let fdisplay = SST.displayed;
  let cmnts = SST.data;
  let issuemap = SST.constants.main_issue_tags;
  let soltnmap = SST.constants.main_solution_tags;
  let i,feat,marker,show_marker,feelcolour;
  let msize = SST.constants.default_marker_size;
  let fcmap = SST.constants.feelingcolourmap;
  let search = "";

  if( !["feeling", "issues", "solutions", "comment", "date_range"].includes(fset) ) {
    console.error("Unknown set '" + fset + "' submitted to SST.filter()")
    return;
  }

  if( fvalue === "input" ) {
    // stop page refresh
    event.preventDefault();

    if( fset === "issues" )    { search = document.getElementById('issues_search').value; }
    if( fset === "solutions" ) { search = document.getElementById('solutions_search').value; }
    if( fset === "comment" )   { search = document.getElementById('comment_search').value; }
  }

  // go through each marker (cmnts)
  for( i in cmnts ) {
    feat = cmnts[i];

    if( typeof feat !== 'function') {
      marker = fmarkers[i];

      // defaults to hidden
      show_marker= false;

      // tag button has been clicked on (not search)
      if( search === "" ) {

        if( fset === "issues" )    { show_marker = feat.issues.includes(issuemap[fvalue]); }
        if( fset === "solutions" ) { show_marker = feat.solutions.includes(soltnmap[fvalue]); }
        if( fset === "feeling" ) {
          show_marker = (fvalue === "" || feat.feeling === fvalue);
          marker.setStyle({fillOpacity: 1, color: "black", weight: 2, fillColor: fcmap[feat.feeling]})
        }

      } else {
        // input value search

        if( fset === "comment" ) {
          show_marker = feat.comment.toLowerCase().includes(search.toLowerCase()) ||
            feat.title.toLowerCase().includes(search.toLowerCase());
        } else {
          // issues or solutions search
          show_marker = feat[fset].map(itag => itag.toLowerCase().includes(search.toLowerCase())).includes(true);
        }
      }

      if( fvalue === "" ) {
        show_marker = true;
      }

      // display or hide marker
      if( show_marker ) {
        marker.setStyle( { fill: true, stroke: true } );
      } else {
        marker.setStyle( { fill: false, stroke: false} );
      }

      // update visibility data
      fdisplay[i] = show_marker;
    }
  }
  SST.displayed = fdisplay;
  SST.dfilter_reset();
};

SST.resize_symbols = function(value) {
  let fmarkers = SST.markers;
  let cmnts = SST.data;
  let i,marker;
  let msize = SST.constants.default_marker_size;

  for( i in cmnts ) {
    feat = cmnts[i];
    if( typeof feat !== 'function') {
      marker = fmarkers[i];
      if( value === "votes" ) {
        marker.setStyle( {radius: Math.sqrt(SST.constants.multip * (feat.votes + 1) / Math.PI)} );
      } else {
        marker.setStyle( {radius: msize} );
      }
    }
  }
};

SST.init_markers = function() {
  let cmnts = SST.data;
  let fmarkers = [];
  let circ;
  let ftm = SST.constants.feelingtextmap;

  for( i in cmnts ) {
    feat = cmnts[i];
    if( typeof feat !== 'function') {
      // L.circle (scales) vs L.circleMarker (always appears same size)
      circ = L.circleMarker([feat.lat, feat.long], {
        color: "black",
        fillColor: '#f03',
        fillOpacity: 0.5,
        weight: 2,
        stroke: true,
        radius: Math.sqrt(SST.constants.multip * (feat.votes+1) / Math.PI)
      }).addTo(SST.map);

      circ.bindPopup("<h4>" + feat.title + "</h4>" +
        "Submitted: " + feat.abdate + "<br>" +
        "Votes: " + feat.votes + "<br>" +
        "Feeling: " + ftm[feat.feeling] + "<br>" +
        "<p>Issues:<br>" + feat.issues.map(i => ("- " + i + "<br>")).toString().replace(/,/g, "") + "</p>" +
        "<p>Suggested " + (feat.wantperm === "Yes" ? "(permanently)" : "") + ":<br>" + 
        feat.solutions.map(s => ("- " + s + "<br>")).toString().replace(/,/g, "")  + "<p>" +
        "<p>Comment:<br>" + feat.comment + "</p>" +
        "<a href='" + feat.url + "'>More info or vote for this</a><br>"
        );

      fmarkers.push(circ);
    }
  }

  // save the markers
  SST.markers = fmarkers;

  // set starting styling
  SST.filter(this, "feeling", "");
};

SST.onload();

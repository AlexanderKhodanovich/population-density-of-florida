// --------------------------------------------- Init SVG ---------------------------------------------- //
//Define Margin
var margin = {left: 20, right: 20, top: 20, bottom: 20 }, 
    width = 1300 - margin.left -margin.right,
    height = 1100 - margin.top - margin.bottom;

//Define SVG
var svg = d3.select("body")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);
var g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// ----------------------------------------- Define Parameters ----------------------------------------- //
// define tooltip parameters
var tt_mgn = 5,
    tt_gap = 2,
    tt_lbl_s = 14,
    tt_fld_s = 12,
    tt_width = 140,
    tt_height = 2*tt_mgn + 1*tt_gap + 2*tt_lbl_s + 0*tt_fld_s,
    tt_dx = 20,
    tt_dy = 20;
var tooltip;

// define geo data here to save it for future redraws
var st_data = null;
var cnt_data = [];
var dnt_data = [];

// define initial color scheme
var color = d3.scaleThreshold()
    .domain([1, 10, 50, 200, 500, 1000, 2000, 4000])
    .range(d3.schemeOrRd[9]);

// define initial stroke for county boundaries
var county_stroke = 'black';

// define legend scale
var legend_scale = d3.scaleSqrt()
    .domain([0, 4500])
    .rangeRound([440, 950]);

// scale to invert y
var invert = d3.scaleLinear()
    .domain([0, 430])
    .range([430, 0]);

var mouse_on_state = false;

// ------------------------------------------ Draw Functions ------------------------------------------- //

function extract_data(json_d, csv_d) {
    state_name = "Florida";
    var mult = 120;
    json_d.transform.translate[0] = -90 * mult;
    json_d.transform.translate[1] = -14 * mult;
    json_d.transform.scale[0] *= mult;
    json_d.transform.scale[1] *= mult;
    
    var sd = topojson.feature(json_d, json_d.objects.states).features;
    var cd = topojson.feature(json_d, json_d.objects.counties).features;
    
    // find state id
    var state_id = -1;
    csv_d.forEach(e => {
        if (e.slabel == state_name) {
            state_id = e.sid2;
        }
    });
    if (state_id == -1)
        throw Error("State doesn't exist!");
    
    // find state
    sd.forEach(s => {
        if (s.id == state_id) {
            st_data = s;
        }
    });
    
    
    // find counties
    cd.forEach((c, i) => {
        if (("0" + c.id).slice(-5).startsWith(("0" + st_data.id).slice(-2))) {
            cnt_data.push(c);
        }
    });
    
    // find densities
    var densities = []
    csv_d.forEach(csv_c => {
        for (var i = 0; i < cnt_data.length; ++i) {
            if (cnt_data[i].id == +csv_c.cid2) {
                dnt_data[i] = {name: csv_c.clabel, density: +csv_c.density};
            }
        }
    });
}

function draw() {
    draw_tooltip();
    draw_mouse_catcher();
    draw_legend();
    draw_state();
    draw_counties();
}

function draw_tooltip() {
    tooltip = g.append("g")
        .attr("class", "tooltip")
        .style("opacity", "0");
    tooltip.append("rect")
        .attr("width", tt_width)
        .attr("height", tt_height);
    tooltip.append("text")
        .attr("class", "label")
        .attr("dx", tt_width/2 + "px")
        .attr("dy", (tt_lbl_s + tt_mgn) + "px") // font-size + margin
        .text("Country");
    for (let i = 0; i < 1; ++i) {
        var field = tooltip.append("g")
            .attr("class", "field")
        field.append("text")
            .attr("class", "key")
            .attr("dx", tt_mgn + "px")
            .attr("dy", 2*tt_lbl_s + tt_mgn + tt_gap + i*(tt_fld_s+tt_gap) + "px")
            .text("Key");
        field.append("text")
            .attr("class", "div")
            .attr("dx", tt_mgn + (tt_fld_s/2)*10 + 2*tt_gap + "px")
            .attr("dy", 2*tt_lbl_s + tt_mgn + tt_gap + i*(tt_fld_s+tt_gap) + "px")
            .text(":");
        field.append("text")
            .attr("class", "val")
            .attr("dx", tt_width - tt_mgn + "px")
            .attr("dy", 2*tt_lbl_s + tt_mgn + tt_gap + i*(tt_fld_s+tt_gap) + "px")
            .text("Value");
    }
}

function draw_legend() {
    var legend = g.append("g").attr("class", "legend")
    legend.selectAll("rect")
        .data(color.range().map(function(d) {
          d = color.invertExtent(d);
          if (d[0] == null) d[0] = legend_scale.domain()[0];
          if (d[1] == null) d[1] = legend_scale.domain()[1];
          return d;
        }))
        .enter().append("rect")
            .attr("height", 8)
            .attr("x", function(d) { return legend_scale(d[0]); })
            .attr("width", function(d) { return legend_scale(d[1]) - legend_scale(d[0]); })
            .attr("fill", function(d) { return color(d[0]); });

    legend.append("text")
        .attr("class", "caption")
        .attr("x", legend_scale.range()[0])
        .attr("y", -6)
        .attr("fill", "#000")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text("Population per square mile");

    legend.call(d3.axisBottom(legend_scale)
        .tickSize(13)
        .tickValues(color.domain()))
        .select(".domain")
        .remove();
}

// svg-wide rectangle used to catch when mouse gets out of state drawing
function draw_mouse_catcher() {
    g.append("g").attr("class", "mouse_catcher")
        .append("rect")
            .attr("fill", "white")
            .attr("width", width)
            .attr("height", height)
            .on("mouseover", function() { mousecatcher_mouseover(this); });
}

function draw_state() {
    g.append("g").attr("class", "state")
        .selectAll("path")
        .data([st_data])
        .enter().append("path")
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("d", d3.geoPath());
}

function draw_counties() {
    var map_g = g.append("g").attr("class", "counties");
    map_g.selectAll("path")
        .data(cnt_data)
        .enter().append("path")
            .attr("stroke", county_stroke)
            .attr("d", d3.geoPath())
            .on("mouseover", function(_, i) { county_mouseover(this, dnt_data[i]); })
            .on("mousemove", function() { county_mousemove(this); })
    map_g.selectAll("path")
        .attr("fill", function(d, i) { return color(dnt_data[i].density); });
}

// ------------------------------------------ Event Handlers ------------------------------------------- //
// handle boundaies switch
var is_boundaries_on = true
function switch_boundaries() {
    if (st_data == null)
        return;
    
    if (is_boundaries_on) {
        county_stroke = 'none';
        g.selectAll("g").remove();
        draw();
        is_boundaries_on = false;
    } else {
        county_stroke = 'black';
        g.selectAll("g").remove();
        draw();
        is_boundaries_on = true;
    }
}

// handle color switch
var is_color_on = true;
function switch_color() {
    if (st_data == null)
        return;
    
    if (is_color_on) {
        color = d3.scaleThreshold()
            .domain([1, 10, 50, 200, 500, 1000, 2000, 4000])
            .range(d3.schemeGreens[9]);
        g.selectAll("g").remove();
        draw();
        is_color_on = false;
    } else {
        color = d3.scaleThreshold()
            .domain([1, 10, 50, 200, 500, 1000, 2000, 4000])
            .range(d3.schemeOrRd[9]);
        g.selectAll("g").remove();
        draw();
        is_color_on = true;
    }
}

// handle county mouseover
function county_mouseover(context, dnt_entry) {
    console.log(dnt_entry);
    var mouse = d3.mouse(context);
    tooltip.select(".label")
        .text(dnt_entry.name);
    tooltip.select(".key")
        .text("Density");
    tooltip.select(".val")
        .text(dnt_entry.density);
    
    tooltip.style("opacity", "1");
    tooltip.selectAll("text,rect")
        .attr("x", (mouse[0] + tt_dx))
        .attr("y", (-mouse[1] + tt_dy))
    
    tooltip.on("mouseover", function() {
        var mouse = d3.mouse(this);
        tooltip.selectAll("text,rect")
            .attr("x", (mouse[0] + tt_dx))
            .attr("y", (-mouse[1] + tt_dy));
    });
    tooltip.on("mousemove", function() {
        var mouse = d3.mouse(this);
        tooltip.selectAll("text,rect")
            .attr("x", (mouse[0] + tt_dx))
            .attr("y", (-mouse[1] + tt_dy));
    });

    tooltip.raise();
}

// handle county mousemove
function county_mousemove(context) {
    var mouse = d3.mouse(context);
    tooltip.selectAll("text,rect")
        .attr("x", (mouse[0] + tt_dx))
        .attr("y", (-mouse[1] + tt_dy));
}

// handle county mouseout
function mousecatcher_mouseover(context) {
    tooltip.transition(1000)
        .style("opacity", "0")
        .on("end", function() {
            tooltip.lower();
        });
}

// ----------------------------------------------- Main ------------------------------------------------ //
// extract data and draw map + legend
Promise.all([d3.json("us-10m.json"), d3.csv("geomapping.csv")]).then(([json_data, csv_data]) => {
    extract_data(json_data, csv_data);
    draw();
});
// ----------------------------------------------------------------------------------------------------- //
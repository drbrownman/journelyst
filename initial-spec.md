Create a web app to help users visualize, explore and share personal travel data.

**General tech and design guidelines**
1. Web app is pure HTML, JS, CSS based frontend only. Do not use node, typescript, vite or python.
2. Loading fonts, libraries, css etc from the public services is allowed
3. For map rendering, use leaflet maps along with many of the publicly available base map tiles
4. Use tooltips and icons wherever appropriate
5. Flat color schemes and modern simple looking fonts and panel layouts
6. Suitable to be run on modern desktop and mobile based browsers i.e. reactive
7. Check for common failures like data format error, missing file, etc. Notify these errors to user in an understanable way.
8. Add a stub for google analytics


**High level specification of the app**
The app is divided into the following four core aspects - each are described ahead in detail.
0. Default view
1. Data ingestion
2. Trip visualization with rich customization
3. Advanced travel data explorations
4. Travel map sharing

Details for each of the above is provided ahead.


**Default view**
0. Default and starting view shows a full screen map in the background. A centered pane is overlayed which includes the following: 
- quick guide about what the user can do with this app
- a button that invites the user to upload their travel data
- Other buttons used for filter described ahead like filters, advanced mode, settings, share all trips
- Tile grid of user's collection of trips (initially empty)


**Data Ingestion**

1A. Data upload
When the user clicks on the upload button, they are shown a dialog that asks them to upload their travel data in google maps timeline format.
Instructions for how to export their timeline data from google maps app is provided in an expandable panel.
Once the user provides the uploaded json, it is read into memory.
If user uploaded multiple files (together or one after other), data from each file is appended to exisiting data of that user.

The google maps timeline data has the following format. Its a json array that contains three types of json objects: visit, activity, timelinePath

Example of Visit element is shown below. Each visit element describes a place visited along with time, location and other meta data like semanticType and probability.
```
  {
    "endTime" : "2026-05-09T19:09:14.078-05:00",
    "startTime" : "2026-05-09T18:51:35.236-05:00",
    "visit" : {
      "hierarchyLevel" : "1",
      "topCandidate" : {
        "probability" : "0.681759",
        "semanticType" : "Unknown",
        "placeID" : "ChIJNVBZj1gtW4YRikK4GA_sSTw",
        "placeLocation" : "geo:30.479551,-97.798760"
      },
      "probability" : "0.934270"
    }
  }
```

Example of Activity element is shown below. Each activity describes the start and end time and location of an activity along with metadata such as type of activity (typically the mode of transportation) and probability.
```
  {
    "endTime" : "2026-05-09T19:41:43.107-05:00",
    "startTime" : "2026-05-09T19:09:14.078-05:00",
    "activity" : {
      "probability" : "0.571617",
      "end" : "geo:30.475887,-97.805634",
      "topCandidate" : {
        "type" : "in passenger vehicle",
        "probability" : "0.500112"
      },
      "distanceMeters" : "763.017517",
      "start" : "geo:30.479312,-97.798734"
    }
  }
```

Example of timelinePath element is shown below. Each timelinePath includes a sequence of geographic points traveled over a period of time.
```
  {
    "endTime" : "2009-11-20T04:00:00.000Z",
    "startTime" : "2009-11-20T02:00:00.000Z",
    "timelinePath" : [
      {
        "point" : "geo:40.447132,-79.944245",
        "durationMinutesOffsetFromStartTime" : "30"
      },
      {
        "point" : "geo:40.451563,-79.946144",
        "durationMinutesOffsetFromStartTime" : "33"
      },
      {
        "point" : "geo:40.445526,-79.948658",
        "durationMinutesOffsetFromStartTime" : "36"
      },
      {
        "point" : "geo:40.452209,-79.946683",
        "durationMinutesOffsetFromStartTime" : "48"
      },
      {
        "point" : "geo:40.452209,-79.946683",
        "durationMinutesOffsetFromStartTime" : "48"
      }
    ]
  }
```

1B. Once the data is uploaded, it is preprocessed in various ways to enhance it for the other features of this app. 
- Each type of travel data elements is loaded into efficient data structures for use with visualization and data exploration. Sorted by time.
- The three types of travel data elements i.e. visits, activities, timelinePath have implicit correspondence among each other which is inferred by common/overlapping time period.
- User's travel (across all three data types) is split into "trips" that combines closely timed clusters of visits, activities and timelinePaths
- Trips are added with additional meta data such as month/year of the trip, destination of the trip (estimated using a list of country, state, city geographic bounding boxes), travel modes (multiple travel modes are supported). Use this metadata to give trips a automated name.
- Visits are augmented with estimated local time based on the geo cordinated and approximate country (using list of bounding boxes) & corresponding time zone.
- Using the local time and duration of visit, approximate the following characteristics of each visit
-- Time of day (early morning, morning, mid day, evening, late night)
-- Purpose of visit (quick stop, couple hours of visit, full day, overnight stay, ...)
- Using the duration and distance of travel of activities and timeline path, estimate the mode of travel (walking, biking, car, subway, train, flight)
- Collect all short travel from the user's very frequently visited locations (like home, work, chores, etc.) and collect them into their own trips with specialized names like Home-Work 2018, Weekend-Chores Summer 2021, etc.
All of these processing of data is stores in appropriate data structures for use in other features.

For country and region bounding boxes used in the above data preprocessing, pre-load the file "regions_privinces_bbox.csv". The file has following format
```
country,region,bbox
Afghanistan,Badakhshan,"35.44241059007663,69.99854943181077,38.47367340200013,74.89230676300008"
Afghanistan,Badghis,"34.5093667668628,62.651762729566315,36.0317323437726,65.04732710206406"
```

1C. For power users (accessible through "advanced" button), all parameters and settings used in the estimated pre-processing of this data is exposed to the power users which they can tweak and rerun the data ingestion and preprocessing steps.


**Trip visualization with rich customization**

2A. Trip collection
- The ingested travel data is used to populate the list of user's collection of trips.
- Each trip in the collection if shown a snapshot of the map bounding box for the trip along with its name and time period (e.g. Texas Summer 2020).
- User is able to view, rename, delete trips as well as merge two trips
- If the user has too many trips, cluster the trip into categories such as all trips to same geographic region, trips in a year, trip by time of year (e.g. christmas trips) etc.

2B. Users are expected to the most time viewing a trip. Using all the data available for a trip, visualize a highly responsive map (using leaflet).
- Trip visits are shown as stops markers on the map. Based on the infered type of stop, use different type of map markers.
- When trip is first viewed, zoom the map to the most prominent region of the trip
- TimelinePaths associated with the trip are drawn on the map to visualize the route taken by the user.
- Only visualize activities that do not have a strong correspondence with timeline. Typically this should correspond to long flights or train journey. Sometimes it could also be travel through a region where timelinePath data was not available. Use appropriate visualize for each e.g. flight should be an arc with appropriate icon.
- Visualize the direction of movement for long trip such as flight or a long drive
- Interactive timeline mode allows users to play the sequence of the trip by clicking play on a timeline as well by manually dragging the timeline marker
- All markers, arcs, paths are clickable that should a bubble with relevant information about the visulized element
- Bubble for stops should contain a link that allows users to open a google maps to the correponding lat/lng. Use google maps URL that opens deep-links for mobile view.
- User is allowed to hide specific markers, paths, activites from the trip

2C. Trip visualizations should be highly editable and customizable.
- User should be allowed to change the display of the map using different base maps
- User is allowed to customized their trip map by editing the markers, color/thickness/icon of lines, etc.

**Advanced travel data explorations**
Accessible through appropriate buttons within the default pane of the app

3A. All the underlying data for a trip should be auditable  i.e. trips, visits, activity, timelinepath and all their metadata and interconnections
- "Advanced" button
- User is able view, edit and delete every element and field of the data
- This mode is available only for power users on desktop based browsers

3B. Allows user to explore their data by filtering it in various ways including
- "Filter" button which expands a toolbox of various types of filters
- filter by time (using a calendar)
- filtering by bounding box
- filtering by geographical region
- filtering by trip duration
- combination of the above


**Travel map sharing**

4A. User can share one trip at a trip as well as their entire collection of trip
- Support sharing as an embedded render map into other webpage; this should download as single html webpage with all data, js and css included
- Supporting sharing download as a high resolution image that they can post on their social media
- Support downloading a video showing the animated timeline progress of a trip that they can post on their social media


**Other guidelines**
- Double check all of the above requirements and features are being faithfully implemented down to every fine detail.
- Test for common things that can go wrong e.g. map not rendering, data not loading 
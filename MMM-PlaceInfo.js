/* global Module */

/* Magic Mirror
 * Module: MMM-PlaceInfo
 *
 * By Nick Williams
 * MIT Licensed.
 */

Module.register("MMM-PlaceInfo", {
  defaults: {
    symbols: null,
    units: config.units,
    animationSpeed: 1000,
    updateInterval: 1000 * 3600, // update every hour
    timeFormat: "HH:mm A",
    lang: config.language,
    showCustomHeader: false,
    layoutStyle: "table",
    showFlag: true,
    showText: true,

    weatherUnits: config.units,
    weatherAPI: "https://api.openweathermap.org/data",
    weatherAPIEndpoint: "weather",
    weatherAPIVersion: "2.5",
    weatherAPIKey: "",
    weatherInterval: 10 * 60 * 1000, // every 10 minutes
    weatherLoadDelay: 0,
    weatherRetryDelay: 2500,
    weatherPrecision: 0,

    weatherIcons: {
      "01d": "wi-day-sunny",
      "02d": "wi-day-cloudy",
      "03d": "wi-cloudy",
      "04d": "wi-cloudy-windy",
      "09d": "wi-showers",
      "10d": "wi-rain",
      "11d": "wi-thunderstorm",
      "13d": "wi-snow",
      "50d": "wi-fog",
      "01n": "wi-night-clear",
      "02n": "wi-night-cloudy",
      "03n": "wi-night-cloudy",
      "04n": "wi-night-cloudy",
      "09n": "wi-night-showers",
      "10n": "wi-night-rain",
      "11n": "wi-night-thunderstorm",
      "13n": "wi-night-snow",
      "50n": "wi-night-alt-cloudy-windy"
    },

    currencyAPI: "http://data.fixer.io/api/latest",
    currencyBase: "EUR",
    currencyRelativeTo: "EUR",
    currencyReversed: false,
    currencyPrecision: 3,
    currencyInterval: 4 * 60 * 60 * 1000, // 4hr
    currencyLoadDelay: 0,
    currencyRetryDelay: 60 * 60 * 1000 // retry hourly
  },

  state: {
    weather: {
      timer: undefined,
      values: {},
      loaded: false
    },
    currency: {
      timer: undefined,
      values: {},
      loaded: false
    }
  },

  getScripts: function () {
    return ["weather-icons.css", "moment.js"];
  },

  getStyles: function () {
    return ["MMM-PlaceInfo.css"];
  },

  loadCSS: function () {
    var css = [
      {
        id: "flag-icon-CSS",
        href: "https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/2.8.0/css/flag-icon.min.css"
      }
    ];
    css.forEach(function (c) {
      if (!document.getElementById(c.id)) {
        var head = document.getElementsByTagName("head")[0];
        var link = document.createElement("link");
        link.id = c.id;
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = c.href;
        link.media = "all";
        head.appendChild(link);
      }
    });
  },

  start: function () {
    this.loadCSS();

    this.state.cstatus = "Loading"; 
    this.state.wstatus = "Loading";
    this.state.weather.fn = this.updateWeather.bind(this);
    this.state.weather.interval = this.config.weatherInterval;
    this.state.currency.fn = this.updateCurrencies.bind(this);
    this.state.currency.interval = this.config.currencyInterval;

    if (!this.config.currencyAPIKey) {
      this.state.csummary = "disabled (no API key)";
    } else {
      this.scheduleUpdate(this.state.currency, this.config.currencyLoadDelay);
    }
    if (!this.config.weatherAPIKey) {
      this.state.wsummary = "disabled (no API key)";
    } else {
      this.scheduleUpdate(this.state.weather, this.config.weatherLoadDelay);
    }

    if (this.config.currencyBase == "") {
      this.config.currencyBase = "EUR";
    }

    var self = this;
    setInterval(function () {
      self.updateDom();
    }, self.config.animationSpeed);
  },

  getDom: function () {
    var wrapper = document.createElement("div");

    if (this.config.showCustomHeader) {
      var customHeader = document.createElement("div");
      var currencyInfo = "";
      if (!this.config.currencyAPIKey) {
        currencyInfo += "Currency data disabled (no API key)\n";
      } else {
        if (this.hasOwnProperty("rateUpdate")) {
          currencyInfo += "Currency data last updated " + this.rateUpdate + "\n";
        }
        if (this.config.currencyRelativeTo) {
          currencyInfo += "Currency relative to " + this.config.currencyRelativeTo + "\n";
        } else {
          currencyInfo = "Currency relative to " + this.config.currencyBase + "\n";
        }
      }
      customHeader.innerHTML = currencyInfo;
      customHeader.className = "light small";
      wrapper.appendChild(customHeader);
    }

    var outputWrapper = document.createElement("div");

    var dataLimit = 3;
    if (this.config.places.length == 4) {
      dataLimit = 2;
    } else if (this.config.places.length == 7) {
      dataLimit = 4;
    } else if (this.config.places.length > 9) {
      dataLimit = 4;
    }

    if (this.config.layoutStyle == "table") {
      var table = document.createElement("table");
      table.className = "placetable";
    }

    for (var placeIdx in this.config.places) {
      var place = this.config.places[placeIdx];
      if (this.config.layoutStyle == "table") {
        if (placeIdx % dataLimit == 0) {
          var row = document.createElement("tr");
        }
        var cell = document.createElement("td");
      }
      var placeContainer = document.createElement("span");

      if (place.flag != "") {
        var flagWrapper = document.createElement("div");
        flagWrapper.className = "flag";
        var flagIconWrapper = document.createElement("span");
        flagIconWrapper.className = "flag-icon flag-icon-squared";
        flagIconWrapper.className += " flag-icon-" + place.flag;
        flagWrapper.appendChild(flagIconWrapper);
        placeContainer.appendChild(flagWrapper);
      }

      var labelWrapper = document.createElement("span");
      labelWrapper.className = "label bright";
      labelWrapper.innerHTML = place.title;
      placeContainer.appendChild(labelWrapper);

      var timeString;
      var clock = moment();
      if (place.timezone == null || undefined) {
        clock.local();
      } else {
        clock.tz(place.timezone);
      }
      timeString = clock.format(this.config.timeFormat);
      var timeWrapper = document.createElement("div");
      timeWrapper.innerHTML = timeString;
      timeWrapper.className = "time small";
      placeContainer.appendChild(timeWrapper);

      if (place.currency != "") {
        var currencySpan = document.createElement("div");
        currencySpan.className = "currency small";
        if (
          this.state.currency.values &&
          this.state.currency.values.hasOwnProperty(place.currency)
        ) {
          currencySpan.innerHTML =
            place.currency + ": " + this.state.currency.values[place.currency];
        } else {
          currencySpan.innerHTML = "Currency " + this.state.cstatus;
          currencySpan.className = "currency dimmed light small";
        }
        placeContainer.appendChild(currencySpan);
      }

      if (place.weatherID) {
        var weatherSpan = document.createElement("div");
        weatherSpan.className = "weather";
        if (!this.state.weather || !this.state.weather.values[placeIdx]) {
          weatherSpan.innerHTML = "Weather " + this.state.wstatus;
          weatherSpan.className = "weather dimmed light small";
        } else {
          var weather = this.state.weather.values[placeIdx];
          var weatherIcon = document.createElement("span");
          var weatherClass =
            "wi weathericon " + this.config.weatherIcons[weather.weather[0].icon];
          weatherIcon.className = weatherClass;
          weatherIcon.innerHTML = "&nbsp;";
          var weatherTemp = document.createElement("span");
          weatherTemp.innerHTML =
            weather.main.temp.toFixed(this.config.weatherPrecision) +
            "&deg;" +
            (this.config.weatherUnits == "imperial" ? "F" : "C");
          weatherTemp.className = "bright";
          weatherSpan.appendChild(weatherIcon);
          weatherSpan.appendChild(weatherTemp);
        }
        placeContainer.appendChild(weatherSpan);
      }

      if (this.config.layoutStyle == "table") {
        cell.appendChild(placeContainer);
        row.appendChild(cell);
        table.appendChild(row);
      } else {
        outputWrapper.appendChild(placeContainer);
      }
    }
    if (this.config.layoutStyle == "table") {
      outputWrapper.appendChild(table);
    }
    wrapper.appendChild(outputWrapper);
    return wrapper;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "CURRENCY_DATA") {
      this.state.currency.values = {};
      if (payload.base !== this.config.currencyBase) {
        this.state.cstatus = "error: currencyBase not in result";
      } else {
        this.rateUpdate = moment().format("MMM Do YYYY HH:mm");
        this.state.cstatus = "Loaded";
        if (this.config.currencyRelativeTo) {
          var base = this.config.currencyRelativeTo.toUpperCase();
          for (var currency in payload.rates) {
            if (base == currency) {
              for (var placeIdx in this.config.places) {
                var place = this.config.places[placeIdx];
                if (payload.rates.hasOwnProperty(place.currency)) {
                  var fx =
                    payload.rates[place.currency] / payload.rates[base];
                  if (this.config.currencyReversed) {
                    fx = payload.rates[base] / payload.rates[place.currency];
                  }
                  this.state.currency.values[place.currency] = fx.toFixed(
                    this.config.currencyPrecision
                  );
                }
              }
            }
          }
        } else {
          for (var placeIdx in this.config.places) {
            var place = this.config.places[placeIdx];
            if (payload.rates.hasOwnProperty(place.currency)) {
              this.state.currency.values[place.currency] = payload.rates[
                place.currency
              ].toFixed(this.config.currencyPrecision);
            }
          }
        }
      }
      this.updateDom();
    }

    if (notification === "WEATHER_DATA") {
      if (!payload || !payload.places || payload.places.length == 0) {
        this.state.wstatus = "Error: No payload";
      } else {
        this.state.weather.values = payload.places;
        this.state.wstatus = "Loaded";
      }
      this.updateDom();
    }
  },

  scheduleUpdate: function (stateObj, delay) {
    var self = this;
    stateObj.timer = setTimeout(function () {
      stateObj.fn();
      self.scheduleUpdate(stateObj, stateObj.interval);
    }, delay);
  },

  updateWeather: function () {
    this.sendSocketNotification("GET_WEATHER", {
      weatherAPI: this.config.weatherAPI,
      weatherAPIEndpoint: this.config.weatherAPIEndpoint,
      weatherAPIVersion: this.config.weatherAPIVersion,
      weatherAPIKey: this.config.weatherAPIKey,
      weatherUnits: this.config.weatherUnits,
      places: this.config.places
    });
  },

  updateCurrencies: function () {
    this.sendSocketNotification("GET_CURRENCIES", {
      currencyAPI: this.config.currencyAPI,
      currencyAPIKey: this.config.currencyAPIKey,
      currencyBase: this.config.currencyBase
    });
  }
});

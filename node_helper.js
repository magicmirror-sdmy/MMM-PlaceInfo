const NodeHelper = require("node_helper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const moment = require("moment");

const currencyCachePath = path.resolve(__dirname, "currency_cache.json");

module.exports = NodeHelper.create({
  start: function () {
    this.log("MMM-PlaceInfo helper method started...");
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "GET_WEATHER") {
      this.log("Received GET_WEATHER request", payload);
      this.getWeather(payload);
    }

    if (notification === "GET_CURRENCIES") {
      this.log("Received GET_CURRENCIES request", payload);
      this.getCurrencies(payload);
    }
  },

  getWeather: function (payload) {
    this.log("Fetching weather data...");
    const urls = payload.places.map(place => 
      `${payload.weatherAPI}/${payload.weatherAPIVersion}/${payload.weatherAPIEndpoint}?id=${place.weatherID}&units=${payload.weatherUnits}&appid=${payload.weatherAPIKey}`
    );

    axios.all(urls.map(url => axios.get(url)))
      .then(axios.spread((...responses) => {
        const weatherData = responses.map(response => response.data);
        this.log("Weather data received:", weatherData);
        this.sendSocketNotification("WEATHER_DATA", { places: weatherData });
      }))
      .catch(error => {
        this.logError("Error getting weather data:", error);
      });
  },

  getCurrencies: function (payload) {
    this.log("Fetching currency data...");

    fs.readFile(currencyCachePath, (err, data) => {
      if (err) {
        this.log("No currency cache found, making API call");
        this.fetchAndCacheCurrencyData(payload);
      } else {
        const cache = JSON.parse(data);
        const cacheTimestamp = moment(cache.timestamp);
        const now = moment();

        if (now.diff(cacheTimestamp, 'hours') >= 12) {
          this.log("Currency cache expired, making API call");
          this.fetchAndCacheCurrencyData(payload);
        } else {
          this.log("Using cached currency data");
          this.sendSocketNotification("CURRENCY_DATA", cache.data);
        }
      }
    });
  },

  fetchAndCacheCurrencyData: function (payload) {
    const self = this;
    const url = `https://api.apilayer.com/exchangerates_data/latest?base=${payload.currencyBase}`;

    const requestOptions = {
      method: 'GET',
      headers: { apikey: payload.currencyAPIKey },
      redirect: 'follow'
    };

    axios.get(url, requestOptions)
      .then(response => {
        self.log("Currency data received:", response.data);
        const cache = {
          timestamp: moment().format(),
          data: response.data
        };
        fs.writeFile(currencyCachePath, JSON.stringify(cache), (err) => {
          if (err) {
            self.logError("Error writing currency cache:", err);
          } else {
            self.log("Currency data cached successfully");
          }
        });
        self.sendSocketNotification("CURRENCY_DATA", response.data);
      })
      .catch(error => {
        self.logError("Error getting currency data:", error);
      });
  },

  log: function (...args) {
    console.log(this.name + ":", ...args);
  },

  logError: function (...args) {
    console.error(this.name + ":", ...args);
  }
});

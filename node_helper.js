/* Magic Mirror
 * Node Helper: MMM-PlaceInfo
 *
 * By Nick Williams
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
  start: function () {
    console.log(this.name + " helper method started...");
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "GET_WEATHER") {
      console.log(this.name + ": Received GET_WEATHER request with payload: ", payload);
      this.getWeather(payload);
    }

    if (notification === "GET_CURRENCIES") {
      console.log(this.name + ": Received GET_CURRENCIES request with payload: ", payload);
      this.getCurrencies(payload);
    }

    if (notification === "LOG") {
      console.log(this.name + ": " + payload);
    }
  },

  getWeather: function (payload) {
    console.log(this.name + ": Fetching weather data with API key: " + payload.weatherAPIKey);
    var self = this;
    var urls = [];
    payload.places.forEach(function (place) {
      urls.push(
        `${payload.weatherAPI}/${payload.weatherAPIVersion}/weather?id=${place.weatherID}&units=${payload.weatherUnits}&appid=${payload.weatherAPIKey}`
      );
    });

    axios
      .all(
        urls.map(function (url) {
          return axios.get(url);
        })
      )
      .then(
        axios.spread(function (...responses) {
          var weatherData = responses.map(function (response) {
            return response.data;
          });
          console.log(self.name + ": Weather data received: ", weatherData);
          self.sendSocketNotification("WEATHER_DATA", { places: weatherData });
        })
      )
      .catch(function (error) {
        console.error(self.name + ": Error getting weather data: ", error);
      });
  },

  getCurrencies: function (payload) {
    console.log(this.name + ": Fetching currency data with API key: " + payload.currencyAPIKey);
    var self = this;
    var cacheFile = path.resolve(__dirname, "currency_cache.json");

    // Check if cached data exists and is still valid
    if (fs.existsSync(cacheFile)) {
      var cachedData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      var cacheTime = new Date(cachedData.timestamp * 1000);
      var now = new Date();
      var cacheAge = (now - cacheTime) / 1000; // age in seconds

      // If cache is less than 4 hours old, use it
      if (cacheAge < 4 * 60 * 60) {
        console.log(this.name + ": Using cached currency data.");
        self.sendSocketNotification("CURRENCY_DATA", cachedData);
        return;
      }
    }

    var url = `${payload.currencyAPI}?access_key=${payload.currencyAPIKey}&base=${payload.currencyBase}`;
    console.log(this.name + ": Currency API URL: ", url);

    axios
      .get(url)
      .then(function (response) {
        console.log(self.name + ": Currency data received: ", response.data);
        fs.writeFileSync(cacheFile, JSON.stringify(response.data));
        self.sendSocketNotification("CURRENCY_DATA", response.data);
      })
      .catch(function (error) {
        console.error(self.name + ": Error getting currency data: ", error);
      });
  }
});

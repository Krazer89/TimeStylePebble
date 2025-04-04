var weatherCommon = require('./weather');

// "public" functions
module.exports.getWeather = getWeather;
module.exports.getWeatherFromCoords = getWeatherFromCoords;
module.exports.getForecast = getForecast;
module.exports.getForecastFromCoords = getForecastFromCoords;

var API_ENDPOINT = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
var USER_AGENT = 'TimeStylePebble/1.0 jamie@krazer.one';
var GEOCODE_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

function getWeather(weatherLoc) {
  // Convert location string to coordinates using Nominatim
  var url = GEOCODE_ENDPOINT + '?q=' + encodeURIComponent(weatherLoc) + '&format=json&limit=1';
  
  weatherCommon.xhrRequest(url, 'GET', function(responseText) {
    var locations = JSON.parse(responseText);
    if (locations && locations.length > 0) {
      var pos = {
        coords: {
          latitude: locations[0].lat,
          longitude: locations[0].lon
        }
      };
      getWeatherFromCoords(pos);
    }
  });
}

function getWeatherFromCoords(pos) {
  var url = API_ENDPOINT + '?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude;
  getAndSendWeatherData(url);
}

function getForecast(weatherLoc) {
  // Convert location string to coordinates using Nominatim
  var url = GEOCODE_ENDPOINT + '?q=' + encodeURIComponent(weatherLoc) + '&format=json&limit=1';
  
  weatherCommon.xhrRequest(url, 'GET', function(responseText) {
    var locations = JSON.parse(responseText);
    if (locations && locations.length > 0) {
      var pos = {
        coords: {
          latitude: locations[0].lat,
          longitude: locations[0].lon
        }
      };
      getForecastFromCoords(pos);
    }
  });
}

function getForecastFromCoords(pos) {
  var url = API_ENDPOINT + '?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude;
  getAndSendWeatherData(url, true);
}

function getAndSendWeatherData(url, isForecast) {
  isForecast = isForecast || false;
  var options = {
    headers: {
      'User-Agent': USER_AGENT
    }
  };

  weatherCommon.xhrRequest(url, 'GET', function(responseText) {
    var json = JSON.parse(responseText);
    if (json.properties && json.properties.timeseries) {
      var currentData = json.properties.timeseries[0];
      
      if (!isForecast) {
        sendCurrentWeather(currentData);
      } else {
        sendForecast(json.properties.timeseries);
      }
    }
  });
}

function sendCurrentWeather(data) {
  var temperature = Math.round(data.data.instant.details.air_temperature);
  var symbol = (data.data.next_1_hours && data.data.next_1_hours.summary && data.data.next_1_hours.summary.symbol_code) || 
               (data.data.next_6_hours && data.data.next_6_hours.summary && data.data.next_6_hours.summary.symbol_code) || 
               'fair_day';
  
  var isNight = symbol.indexOf('_night') !== -1;
  var iconToLoad = getIconForConditionCode(symbol, isNight);

  var dictionary = {
    'WeatherTemperature': temperature,
    'WeatherCondition': iconToLoad
  };

  weatherCommon.sendWeatherToPebble(dictionary);
}

function sendForecast(timeseries) {
  var highTemp = -Number.MAX_VALUE;
  var lowTemp = Number.MAX_VALUE;
  
  // Look at next 24 hours of forecasts
  var next24Hours = timeseries.slice(0, 8);
  
  for (var i = 0; i < next24Hours.length; i++) {
    var temp = next24Hours[i].data.instant.details.air_temperature;
    highTemp = Math.max(highTemp, temp);
    lowTemp = Math.min(lowTemp, temp);
  }

  // Use the weather condition for 6 hours from now as representative
  var forecastData = timeseries[2].data.next_6_hours || {};
  var forecastSymbol = (forecastData.summary && forecastData.summary.symbol_code) || 'fair_day';
  var iconToLoad = getIconForConditionCode(forecastSymbol, false);

  var dictionary = {
    'WeatherForecastCondition': iconToLoad,
    'WeatherForecastHighTemp': Math.round(highTemp),
    'WeatherForecastLowTemp': Math.round(lowTemp)
  };

  weatherCommon.sendWeatherToPebble(dictionary);
}

function getIconForConditionCode(symbol, isNight) {
  // Strip _day/_night suffix if present
  var baseSymbol = symbol.replace(/_day|_night/, '');
  
  switch(baseSymbol) {
    case 'clearsky':
      return isNight ? weatherCommon.icons.CLEAR_NIGHT : weatherCommon.icons.CLEAR_DAY;
    case 'fair':
    case 'partlycloudy':
      return isNight ? weatherCommon.icons.PARTLY_CLOUDY_NIGHT : weatherCommon.icons.PARTLY_CLOUDY;
    case 'cloudy':
      return weatherCommon.icons.CLOUDY_DAY;
    case 'rainshowers':
    case 'lightrainshowers':
    case 'lightrain':
      return weatherCommon.icons.LIGHT_RAIN;
    case 'rain':
    case 'heavyrain':
    case 'heavyrainshowers':
      return weatherCommon.icons.HEAVY_RAIN;
    case 'sleet':
    case 'sleetshowers':
      return weatherCommon.icons.RAINING_AND_SNOWING;
    case 'snow':
    case 'snowshowers':
    case 'heavysnow':
    case 'heavysnowshowers':
      return weatherCommon.icons.HEAVY_SNOW;
    case 'lightsnow':
    case 'lightsnowshowers':
      return weatherCommon.icons.LIGHT_SNOW;
    case 'thunder':
    case 'thunderstorm':
      return weatherCommon.icons.THUNDERSTORM;
    default:
      return weatherCommon.icons.WEATHER_GENERIC;
  }
}

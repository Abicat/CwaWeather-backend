require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 取得高雄天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「一般天氣預報-今明 36 小時天氣預報」資料集
 */
const getKaohsiungWeather = async (req, res) => {
  try {
    // 檢查是否有設定 API Key
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    // 呼叫 CWA API - 一般天氣預報（36小時）
    // API 文件: https://opendata.cwa.gov.tw/dist/opendata-swagger.html
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName: "新北市",
        },
      }
    );

    // 取得新北市的天氣資料
    const locationData = response.data.records.location[0];

    if (!locationData) {
      return res.status(404).json({
        error: "查無資料",
        message: "無法取得新北市天氣資料",
      });
    }

    // 整理天氣資料
    const weatherData = {
      city: locationData.locationName,
      updateTime: response.data.records.datasetDescription,
      forecasts: [],
    };

    // 解析天氣要素
    const weatherElements = locationData.weatherElement;
    const timeCount = weatherElements[0].time.length;

    for (let i = 0; i < timeCount; i++) {
      const forecast = {
        startTime: weatherElements[0].time[i].startTime,
        endTime: weatherElements[0].time[i].endTime,
        weather: "",
        rain: "",
        minTemp: "",
        maxTemp: "",
        comfort: "",
        windSpeed: "",
      };

      weatherElements.forEach((element) => {
        const value = element.time[i].parameter;
        switch (element.elementName) {
          case "Wx":
            forecast.weather = value.parameterName;
            break;
          case "PoP":
            forecast.rain = value.parameterName + "%";
            break;
          case "MinT":
            forecast.minTemp = value.parameterName + "°C";
            break;
          case "MaxT":
            forecast.maxTemp = value.parameterName + "°C";
            break;
          case "CI":
            forecast.comfort = value.parameterName;
            break;
          case "WS":
            forecast.windSpeed = value.parameterName;
            break;
        }
      });

      weatherData.forecasts.push(forecast);
    }

    res.json({
      success: true,
      data: weatherData,
    });
  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);

    if (error.response) {
      // API 回應錯誤
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
        details: error.response.data,
      });
    }

    // 其他錯誤
    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得天氣資料，請稍後再試",
    });
  }
};

/**
 * 取得新北市一週天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「鄉鎮天氣預報-單一鄉鎮市區預報資料」資料集 (F-D0047-069)
 */
const getWeeklyWeather = async (req, res) => {
  try {
    // 檢查是否有設定 API Key
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    // 呼叫 CWA API - 一週天氣預報
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-D0047-069`,
      {
        params: {
          Authorization: CWA_API_KEY,
        },
      }
    );

    // 取得新北市的天氣資料
    const locations = response.data.records.locations[0].location;

    if (!locations || locations.length === 0) {
      return res.status(404).json({
        error: "查無資料",
        message: "無法取得新北市一週天氣資料",
      });
    }

    // 整理所有區域的天氣資料
    const weatherData = {
      city: "新北市",
      updateTime: response.data.records.datasetDescription,
      locations: [],
    };

    // 解析每個區域的天氣資料
    locations.forEach((location) => {
      const locationInfo = {
        locationName: location.locationName,
        forecasts: [],
      };

      const weatherElements = location.weatherElement;

      // 找到「天氣現象」的資料
      const weatherElement = weatherElements.find(
        (el) => el.elementName === "天氣現象"
      );

      if (weatherElement && weatherElement.time) {
        weatherElement.time.forEach((timeData) => {
          const elementValue = timeData.elementValue[0];

          locationInfo.forecasts.push({
            startTime: timeData.startTime,
            endTime: timeData.endTime,
            weather: elementValue.value || "資料不足",
          });
        });
      }

      weatherData.locations.push(locationInfo);
    });

    res.json({
      success: true,
      data: weatherData,
    });
  } catch (error) {
    console.error("取得一週天氣資料失敗:", error.message);

    if (error.response) {
      // API 回應錯誤
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得一週天氣資料",
        details: error.response.data,
      });
    }

    // 其他錯誤
    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得一週天氣資料，請稍後再試",
    });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API",
    endpoints: {
      kaohsiung: "/api/weather/kaohsiung",
      weekly: "/api/weather/weekly",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 取得高雄天氣預報
app.get("/api/weather/kaohsiung", getKaohsiungWeather);

// 取得新北市一週天氣預報
app.get("/api/weather/weekly", getWeeklyWeather);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
});

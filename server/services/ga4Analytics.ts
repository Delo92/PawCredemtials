import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getCredentials } from "../firebase-admin";

let _client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (_client) return _client;
  const creds = getCredentials();
  _client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: creds.clientEmail,
      private_key: creds.privateKey,
    },
    projectId: creds.projectId,
  });
  return _client;
}

function getPropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) throw new Error("GA4_PROPERTY_ID environment variable not set");
  return id;
}

export async function getGA4Report(dateRange: string = "30d") {
  const client = getClient();
  const propertyId = getPropertyId();

  const startDate = dateRange === "7d" ? "7daysAgo"
    : dateRange === "90d" ? "90daysAgo"
    : dateRange === "1y" ? "365daysAgo"
    : "30daysAgo";

  try {
    const [overviewResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: "today" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
        { name: "newUsers" },
      ],
    });

    const overviewRow = overviewResponse.rows?.[0];
    const overview = {
      activeUsers: parseInt(overviewRow?.metricValues?.[0]?.value || "0"),
      sessions: parseInt(overviewRow?.metricValues?.[1]?.value || "0"),
      pageViews: parseInt(overviewRow?.metricValues?.[2]?.value || "0"),
      avgSessionDuration: parseFloat(overviewRow?.metricValues?.[3]?.value || "0"),
      bounceRate: parseFloat(overviewRow?.metricValues?.[4]?.value || "0"),
      newUsers: parseInt(overviewRow?.metricValues?.[5]?.value || "0"),
    };

    const [pageResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "activeUsers" },
      ],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    });

    const topPages = (pageResponse.rows || []).map(row => ({
      path: row.dimensionValues?.[0]?.value || "",
      views: parseInt(row.metricValues?.[0]?.value || "0"),
      users: parseInt(row.metricValues?.[1]?.value || "0"),
    }));

    const [dailyResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    });

    const dailyData = (dailyResponse.rows || []).map(row => {
      const raw = row.dimensionValues?.[0]?.value || "";
      const formatted = raw.length === 8
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        : raw;
      return {
        date: formatted,
        users: parseInt(row.metricValues?.[0]?.value || "0"),
        sessions: parseInt(row.metricValues?.[1]?.value || "0"),
        pageViews: parseInt(row.metricValues?.[2]?.value || "0"),
      };
    });

    const [sourceResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    });

    const trafficSources = (sourceResponse.rows || []).map(row => ({
      source: row.dimensionValues?.[0]?.value || "(direct)",
      sessions: parseInt(row.metricValues?.[0]?.value || "0"),
    }));

    return { overview, topPages, dailyData, trafficSources };
  } catch (error: any) {
    console.error("GA4 API error:", error.message);
    throw error;
  }
}

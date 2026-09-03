import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "./ChartFrame";

function extractField(abstract, field) {
  if (!abstract) return null;

  const pattern = new RegExp(`${field}:\\s*([^;]+)`, "i");
  const match = abstract.match(pattern);

  return match ? match[1].trim() : null;
}

function extractValue(abstract) {
  const value = extractField(abstract, "Numeric value");

  if (!value) return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function extractUncertainty(abstract) {
  const value = extractField(abstract, "Uncertainty interval");

  if (!value) {
    return {
      lower: null,
      upper: null,
    };
  }

  const match = value.match(/([0-9.]+)\s*[–-]\s*([0-9.]+)/);

  if (!match) {
    return {
      lower: null,
      upper: null,
    };
  }

  return {
    lower: Number(match[1]),
    upper: Number(match[2]),
  };
}

function shortName(title) {
  const name = title.toLowerCase();

  if (name.includes("age-standardized")) {
    return "Age-standardized";
  }

  if (name.includes("crude")) {
    return "Crude";
  }

  if (name.includes("obesity")) {
    return "Obesity";
  }

  if (name.includes("hypertension")) {
    return "Hypertension";
  }

  if (name.includes("diabetes")) {
    return "Diabetes";
  }

  return title.length > 28 ? `${title.slice(0, 28)}…` : title;
}

function formatUncertainty(lower, upper) {
  if (lower === null || upper === null) {
    return "Not provided";
  }

  return `${lower.toFixed(1)}–${upper.toFixed(1)}%`;
}

export function WHOChart({ results }) {
  const data = results
    .map((result) => {
      const uncertainty = extractUncertainty(result.abstract);

      return {
        name: shortName(result.title),
        value: extractValue(result.abstract) ?? 0,
        lower: uncertainty.lower,
        upper: uncertainty.upper,
        year: result.year,
        indicator:
          extractField(result.abstract, "Indicator") ?? result.title,
        location:
          extractField(result.abstract, "Location") ?? "Not provided",
        locationType:
          extractField(result.abstract, "Location type") ?? "Not provided",
        reportedValue:
          extractField(result.abstract, "Reported value") ?? "Not provided",
        recordDate:
          extractField(result.abstract, "WHO record date") ?? "Not provided",
        sourceId: result.source_id ?? "Not provided",
      };
    })
    .filter((item) => item.value > 0);

  if (data.length === 0) {
    return null;
  }

  const first = data[0];

  return (
    <section className="evitrack-section">
      <div className="evitrack-chart-header">
        <div>
          <h3>India epidemiology</h3>
          <p>
            WHO GHO epidemiology estimates returned for India.
          </p>
        </div>
      </div>

      <div
        style={{
          marginBottom: "16px",
          padding: "14px 16px",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          fontSize: "12px",
          lineHeight: 1.7,
        }}
      >
        <strong>WHO Global Health Observatory</strong>

        <div>
          Location: <strong>{first.location}</strong>
          {" · "}
          {first.locationType}
        </div>

        <div>
          Year: <strong>{first.year ?? "Not provided"}</strong>
        </div>

        <div>Source: WHO GHO</div>
      </div>

      <ChartFrame height={340}>
        {(width) => (
          <BarChart
            width={width}
            height={340}
            data={data}
            margin={{
              top: 28,
              right: 24,
              left: 8,
              bottom: 28,
            }}
          >
            <CartesianGrid
              stroke="var(--border)"
              vertical={false}
            />

            <XAxis
              dataKey="name"
              tick={{
                fontSize: 11,
                fill: "var(--ink-2)",
              }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              unit="%"
              tick={{
                fontSize: 11,
                fill: "var(--ink-muted)",
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              cursor={{
                fill: "var(--surface-2)",
              }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line-2)",
                borderRadius: "8px",
                fontSize: 12,
              }}
              labelStyle={{
                color: "var(--ink)",
                fontWeight: 600,
              }}
              itemStyle={{
                color: "var(--ink-2)",
              }}
              formatter={(value) => [
                `${Number(value).toFixed(1)}%`,
                "Prevalence",
              ]}
              labelFormatter={(label, payload) => {
                const point = payload?.[0]?.payload;

                if (!point) {
                  return String(label);
                }

                return `${point.name} · ${point.year ?? "Year unavailable"}`;
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) {
                  return null;
                }

                const point = payload[0].payload;

                return (
                  <div
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line-2)",
                      borderRadius: "8px",
                      padding: "12px",
                      maxWidth: "340px",
                      fontSize: "12px",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong>{point.indicator}</strong>

                    <div>
                      Numeric value: {point.value.toFixed(6)}%
                    </div>

                    <div>
                      Reported value: {point.reportedValue}%
                    </div>

                    <div>
                      Uncertainty interval:{" "}
                      {formatUncertainty(point.lower, point.upper)}
                    </div>

                    <div>Location: {point.location}</div>

                    <div>
                      Location type: {point.locationType}
                    </div>

                    <div>
                      Year: {point.year ?? "Not provided"}
                    </div>

                    <div>
                      WHO record date: {point.recordDate}
                    </div>

                    <div>
                      Indicator ID: {point.sourceId}
                    </div>

                    <div>Source: WHO GHO</div>
                  </div>
                );
              }}
            />

            <Bar
              dataKey="value"
              name="Prevalence"
              fill="var(--series-4)"
              radius={[2, 2, 0, 0]}
              maxBarSize={72}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="reportedValue"
                position="top"
                style={{
                  fill: "var(--ink)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            </Bar>
          </BarChart>
        )}
      </ChartFrame>
    </section>
  );
}

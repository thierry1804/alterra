import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { GenderBreakdown } from "../../lib/dashboard";

interface GenderBreakdownChartProps {
  data: GenderBreakdown;
}

const COLORS: Record<string, string> = {
  Masculin: "#3f3f46",
  Féminin: "#a1a1aa",
  "Non renseigné": "#e4e4e7",
};

export default function GenderBreakdownChart({ data }: GenderBreakdownChartProps) {
  const rows = [
    { label: "Masculin", value: data.masculin },
    { label: "Féminin", value: data.feminin },
    { label: "Non renseigné", value: data.nonRenseigne },
  ].filter((row) => row.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition des genres</CardTitle>
      </CardHeader>
      <CardContent>
        {data.total === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">Aucun MOC actif.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {rows.map((row) => (
                    <Cell key={row.label} fill={COLORS[row.label]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const count = Number(value ?? 0);
                    return [`${count} MOC (${((count / data.total) * 100).toFixed(1)} %)`, name];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

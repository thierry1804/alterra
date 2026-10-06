import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { GenderByGroup } from "../../lib/dashboard";

interface GenderRatioBarChartProps {
  title: string;
  data: GenderByGroup[];
  emptyLabel: string;
}

export default function GenderRatioBarChart({ title, data, emptyLabel }: GenderRatioBarChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">{emptyLabel}</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  stroke="#71717a"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 12 }}
                  stroke="#71717a"
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="masculin" name="Masculin" stackId="sexe" fill="#3f3f46" />
                <Bar dataKey="feminin" name="Féminin" stackId="sexe" fill="#a1a1aa" />
                <Bar
                  dataKey="nonRenseigne"
                  name="Non renseigné"
                  stackId="sexe"
                  fill="#e4e4e7"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

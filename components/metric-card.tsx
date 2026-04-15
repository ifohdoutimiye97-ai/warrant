type MetricCardProps = {
  label: string;
  value: string;
  note: string;
};

export function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <article className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <p className="stat-note">{note}</p>
    </article>
  );
}

export function BrandRail({ className = "" }) {
  return (
    <div className={`brand-rail ${className}`.trim()} aria-hidden="true">
      <span className="brand-rail-navy" />
      <span className="brand-rail-white" />
      <span className="brand-rail-green" />
      <span className="brand-rail-sky" />
      <span className="brand-rail-red" />
    </div>
  );
}

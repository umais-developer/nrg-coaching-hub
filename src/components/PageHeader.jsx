export default function PageHeader({ eyebrow, title, description, variant = "ph-teal", children }) {
  return (
    <div className={`page-header ${variant} animate-in`}>
      {eyebrow && (
        <div className="page-header-eyebrow">{eyebrow}</div>
      )}
      <h1>{title}</h1>
      {description && <p className="text-secondary mb-0">{description}</p>}
      {children}
    </div>
  );
}

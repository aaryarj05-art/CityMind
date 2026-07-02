const SectionHeader = ({ title, subtitle, action }) => {
  return (
    <div className="flex justify-between items-end mb-4 border-b border-navy-700 pb-3">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export default SectionHeader;

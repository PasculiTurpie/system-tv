import PropTypes from 'prop-types';

export default function AnnotationInspector({ annotation }) {
  return (
    <section aria-labelledby="annotation-inspector-title" className="space-y-3 text-sm">
      <div>
        <h2 id="annotation-inspector-title" className="text-xs uppercase tracking-wide text-slate-400">
          Anotación
        </h2>
        <p className="text-lg font-semibold text-white">{annotation.id}</p>
      </div>
      <p className="text-xs text-slate-400">Las anotaciones se editan directamente en el lienzo.</p>
    </section>
  );
}

AnnotationInspector.propTypes = {
  annotation: PropTypes.object.isRequired,
};

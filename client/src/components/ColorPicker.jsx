const COLORS = [
  ['red', '#c81e2e'],
  ['yellow', '#eda800'],
  ['green', '#1f7a33'],
  ['blue', '#114fa5'],
];

export default function ColorPicker({ onPick, onCancel }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Pick a color</h2>
        <div className="color-options">
          {COLORS.map(([name, hex]) => (
            <button
              key={name}
              className="color-btn"
              style={{ background: hex }}
              title={name}
              onClick={() => onPick(name)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

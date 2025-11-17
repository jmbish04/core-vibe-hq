import "./modal.css";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	children?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
	if (!isOpen) return null;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: expected
		// biome-ignore lint/a11y/useKeyWithClickEvents: expected
		<div className="modal-overlay" onClick={onClose}>
			{/** biome-ignore lint/a11y/noStaticElementInteractions: expected */}
			{/** biome-ignore lint/a11y/useKeyWithClickEvents: expected */}
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				<button type="button" className="modal-close" onClick={onClose}>
					&times;
				</button>
				<div className="modal-body">{children}</div>
			</div>
		</div>
	);
};

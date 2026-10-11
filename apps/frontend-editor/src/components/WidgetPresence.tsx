import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { WIDGET_PRESENCES, presenceFromWidget, type WidgetPresence } from '@vanstack/xml';

export { WIDGET_PRESENCES, presenceFromWidget, type WidgetPresence };

export const WIDGET_PRESENCE_LABEL_KEYS: Record<WidgetPresence, string> = {
  visible: 'presenceOptionVisible',
  removed: 'presenceOptionRemoved',
  hidden: 'presenceOptionHidden',
  occupy: 'presenceOptionOccupy',
};

/** 虚线眼睛：无视图但仍占位的「隐藏但占据空间」。 */
function DashedEyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12 18.5 18.5 12 18.5 1.5 12 1.5 12z" strokeDasharray="2.4 2.2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function PresenceEyeIcon({ presence }: { presence: WidgetPresence }) {
  if (presence === 'removed') {
    return <EyeInvisibleOutlined />;
  }
  if (presence === 'hidden') {
    return <EyeInvisibleOutlined style={{ transform: 'scaleX(-1)' }} />;
  }
  if (presence === 'occupy') {
    return <DashedEyeIcon />;
  }
  return <EyeOutlined />;
}
import { theme } from 'antd';

/** 属性检查器和事件弹窗共用的深色主题。工具条仍用浅色。 */
export const inspectorTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#3dba9a',
    colorBgContainer: '#33404c',
    colorBgContainerDisabled: '#2a333c',
    colorBgElevated: '#171e25',
    colorError: '#ff4d4f',
    colorBorder: 'rgba(255, 255, 255, 0.26)',
    colorText: 'rgba(255, 255, 255, 0.92)',
    colorTextHeading: 'rgba(255, 255, 255, 0.95)',
    colorTextLabel: 'rgba(255, 255, 255, 0.84)',
    colorTextPlaceholder: 'rgba(255, 255, 255, 0.48)',
    colorFillTertiary: 'rgba(255, 255, 255, 0.12)',
  },
};

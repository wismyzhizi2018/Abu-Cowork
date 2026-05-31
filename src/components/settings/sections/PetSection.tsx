/**
 * Pet settings section — size slider, theme selection, DND, sound
 *
 * PRD §5 (size system), §6 (themes), §9 (DND)
 */

import { useState } from 'react';
import { usePetStore } from '@/stores/petStore';
import { invoke } from '@tauri-apps/api/core';

export default function PetSection() {
  const enabled = usePetStore((s) => s.enabled);
  const size = usePetStore((s) => s.size);
  const dnd = usePetStore((s) => s.dnd);
  const soundEnabled = usePetStore((s) => s.soundEnabled);
  const sleepSequenceMode = usePetStore((s) => s.sleepSequenceMode);

  const setEnabled = usePetStore((s) => s.setEnabled);
  const setMode = usePetStore((s) => s.setMode);
  const setSize = usePetStore((s) => s.setSize);
  const setDnd = usePetStore((s) => s.setDnd);
  const setSoundEnabled = usePetStore((s) => s.setSoundEnabled);
  const setSleepSequenceMode = usePetStore((s) => s.setSleepSequenceMode);

  const [importing, setImporting] = useState(false);

  const handleTogglePet = async () => {
    if (enabled) {
      setEnabled(false);
      setMode('off');
      await invoke('pet_hide').catch(() => {});
    } else {
      setEnabled(true);
      setMode('full');
      await invoke('pet_show').catch(() => {});
    }
  };

  const handleSizeChange = (value: number) => {
    setSize(value);
    // PRD §5.1: pixels = screenLongEdge × (slider × 30 / 100) / 100
    // PRD §5.2: portrait screens get ×1.6 boost; width cap at 60%
    const longEdge = Math.max(window.screen.width, window.screen.height);
    const shortEdge = Math.min(window.screen.width, window.screen.height);
    const isPortrait = window.screen.height > window.screen.width;

    let pixels = Math.round(longEdge * (value * 30 / 100) / 100);
    if (isPortrait) pixels = Math.round(pixels * 1.6);

    // Width cap at 60% of short edge
    const maxPixels = Math.round(shortEdge * 0.6);
    pixels = Math.min(pixels, maxPixels);

    invoke('pet_set_size', { width: pixels, height: pixels }).catch(() => {});
  };

  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const handleImportCodexPet = async () => {
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const file = await open({
        multiple: false,
        filters: [{ name: 'Codex Pet', extensions: ['zip'] }],
      });
      if (file) {
        const { importCodexPetFromPath } = await import('@/core/pet/codexPetImporter');
        const result = await importCodexPetFromPath(file as string);
        if (result.success) {
          setImportSuccess(`导入成功！主题 ID: ${result.themeId}`);
        } else {
          setImportError(result.error ?? '导入失败');
        }
      }
    } catch (err) {
      setImportError(`导入异常: ${err}`);
    } finally {
      setImporting(false);
    }
  };

  const sizePresets = [
    { label: 'S', value: 25 },
    { label: 'M', value: 50 },
    { label: 'L', value: 75 },
    { label: 'XL', value: 100 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-200 mb-4">桌宠设置</h3>

        {/* Enable/Disable */}
        <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
          <div>
            <div className="text-sm text-gray-300">启用桌宠</div>
            <div className="text-xs text-gray-500">在桌面上显示阿布</div>
          </div>
          <button
            onClick={handleTogglePet}
            className={`px-4 py-1.5 rounded text-sm ${
              enabled
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {enabled ? '关闭' : '开启'}
          </button>
        </div>

        {/* Size Slider */}
        {enabled && (
          <div className="py-3 border-b border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-300">尺寸</div>
              <div className="flex gap-1">
                {sizePresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleSizeChange(preset.value)}
                    className={`px-2 py-0.5 rounded text-xs ${
                      size === preset.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={size}
              onChange={(e) => handleSizeChange(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        )}

        {/* DND Mode */}
        {enabled && (
          <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
            <div>
              <div className="text-sm text-gray-300">勿扰模式</div>
              <div className="text-xs text-gray-500">静音并暂停状态变化</div>
            </div>
            <button
              onClick={() => setDnd(!dnd)}
              className={`px-4 py-1.5 rounded text-sm ${
                dnd
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {dnd ? '关闭勿扰' : '开启勿扰'}
            </button>
          </div>
        )}

        {/* Sound */}
        {enabled && (
          <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
            <div>
              <div className="text-sm text-gray-300">音效</div>
              <div className="text-xs text-gray-500">任务完成和通知音效</div>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-4 py-1.5 rounded text-sm ${
                soundEnabled
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {soundEnabled ? '关闭' : '开启'}
            </button>
          </div>
        )}

        {/* Sleep Sequence */}
        {enabled && (
          <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
            <div>
              <div className="text-sm text-gray-300">睡眠动画</div>
              <div className="text-xs text-gray-500">完整序列或直接入睡</div>
            </div>
            <select
              value={sleepSequenceMode}
              onChange={(e) => setSleepSequenceMode(e.target.value as 'full' | 'direct')}
              className="bg-gray-700 text-gray-300 text-sm rounded px-3 py-1.5 border border-gray-600"
            >
              <option value="full">完整序列</option>
              <option value="direct">直接入睡</option>
            </select>
          </div>
        )}

        {/* Codex Pet Import */}
        <div className="py-3 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-300">导入 Codex Pet</div>
              <div className="text-xs text-gray-500">从 zip 包导入社区宠物</div>
            </div>
            <button
              onClick={handleImportCodexPet}
              disabled={importing}
              className="px-4 py-1.5 rounded text-sm bg-gray-700 text-gray-400 hover:bg-gray-600 disabled:opacity-50"
            >
              {importing ? '导入中...' : '选择文件'}
            </button>
          </div>
          {importError && (
            <div className="mt-2 text-xs text-red-400">{importError}</div>
          )}
          {importSuccess && (
            <div className="mt-2 text-xs text-green-400">{importSuccess}</div>
          )}
        </div>
      </div>
    </div>
  );
}

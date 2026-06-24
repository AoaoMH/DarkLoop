/**
 * AI 素材生成辅助脚本
 *
 * 用途：批量调用 Stable Diffusion API 生成像素风素材
 * 使用前配置：
 *   1. 设置 SD API 地址（本地 WebUI 或云端 API）
 *   2. 调整提示词模板
 *   3. 运行 npx tsx tools/generate-sprites.ts
 */

const SD_API_URL = process.env.SD_API_URL || 'http://127.0.0.1:7860';

// 像素风素材提示词模板
const PROMPT_TEMPLATES = {
  hero_warrior: 'pixel art, warrior character sprite, 32x32, medieval fantasy, side view, transparent background, retro game style',
  hero_mage: 'pixel art, mage character sprite, 32x32, medieval fantasy, side view, transparent background, retro game style',
  hero_ranger: 'pixel art, ranger character sprite, 32x32, medieval fantasy, side view, transparent background, retro game style',
  monster_slime: 'pixel art, green slime monster sprite, 32x32, cute, transparent background, retro game style',
  monster_skeleton: 'pixel art, skeleton warrior sprite, 32x32, undead, transparent background, retro game style',
  monster_demon: 'pixel art, demon boss sprite, 64x64, dark fantasy, transparent background, retro game style',
};

const NEGATIVE_PROMPT = 'blurry, low quality, watermark, text, realistic, 3d render, photo';

interface GenerateOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  batchSize?: number;
}

async function generateSprite(options: GenerateOptions): Promise<string[]> {
  // txt2img API 调用
  const response = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: options.prompt,
      negative_prompt: options.negativePrompt || NEGATIVE_PROMPT,
      width: options.width || 32,
      height: options.height || 32,
      steps: options.steps || 20,
      batch_size: options.batchSize || 4,
      // 像素风推荐设置
      sampler_name: 'Euler a',
      cfg_scale: 7,
    }),
  });

  const data = await response.json();
  return data.images || []; // base64 编码的图片
}

async function main() {
  console.log('DarkLoop 素材生成器');
  console.log('====================');

  for (const [name, prompt] of Object.entries(PROMPT_TEMPLATES)) {
    console.log(`生成: ${name}...`);
    try {
      const images = await generateSprite({ prompt, batchSize: 4 });
      console.log(`  -> 生成 ${images.length} 张`);
      // TODO: 保存到 packages/client/src/assets/sprites/
    } catch (err) {
      console.error(`  -> 失败: ${err}`);
    }
  }
}

main().catch(console.error);

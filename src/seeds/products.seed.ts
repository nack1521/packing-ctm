import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProductsService } from '../products/products.service';

async function seedProducts() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const productsService = app.get(ProductsService);

  const cosmeticsProducts = [
    {
      product_name: "Maybelline Fit Me Foundation",
      product_weight: 0.03, // 30ml
      dimensions: {
        width: 3.5,
        length: 3.5,
        height: 11.2
      }
    },
    {
      product_name: "L'Oreal Paris Mascara Voluminous",
      product_weight: 0.013, // 13ml
      dimensions: {
        width: 2.1,
        length: 2.1,
        height: 15.8
      }
    },
    {
      product_name: "MAC Ruby Woo Lipstick",
      product_weight: 0.003, // 3g
      dimensions: {
        width: 1.9,
        length: 1.9,
        height: 8.5
      }
    },
    {
      product_name: "Urban Decay Naked Eyeshadow Palette",
      product_weight: 0.195, // 195g
      dimensions: {
        width: 21.5,
        length: 12.7,
        height: 2.0
      }
    },
    {
      product_name: "The Ordinary Niacinamide 10% + Zinc 1%",
      product_weight: 0.03, // 30ml
      dimensions: {
        width: 2.8,
        length: 2.8,
        height: 9.5
      }
    },
    {
      product_name: "Fenty Beauty Gloss Bomb",
      product_weight: 0.009, // 9ml
      dimensions: {
        width: 2.5,
        length: 2.5,
        height: 12.0
      }
    },
    {
      product_name: "CeraVe Daily Moisturizing Lotion",
      product_weight: 0.355, // 355ml
      dimensions: {
        width: 6.4,
        length: 4.1,
        height: 19.1
      }
    },
    {
      product_name: "Clinique Dramatically Different Moisturizer",
      product_weight: 0.125, // 125ml
      dimensions: {
        width: 5.7,
        length: 5.7,
        height: 12.7
      }
    },
    {
      product_name: "NYX Professional Makeup Setting Spray",
      product_weight: 0.06, // 60ml
      dimensions: {
        width: 4.0,
        length: 4.0,
        height: 15.5
      }
    },
    {
      product_name: "Neutrogena Hydra Boost Water Gel",
      product_weight: 0.05, // 50ml
      dimensions: {
        width: 6.0,
        length: 6.0,
        height: 5.5
      }
    },
    // Additional 100 products
    {
      product_name: "Estee Lauder Double Wear Foundation",
      product_weight: 0.03,
      dimensions: { width: 4.2, length: 4.2, height: 12.5 }
    },
    {
      product_name: "Charlotte Tilbury Pillow Talk Lipstick",
      product_weight: 0.0035,
      dimensions: { width: 2.0, length: 2.0, height: 9.0 }
    },
    {
      product_name: "Too Faced Better Than Sex Mascara",
      product_weight: 0.017,
      dimensions: { width: 2.5, length: 2.5, height: 16.0 }
    },
    {
      product_name: "Anastasia Beverly Hills Brow Wiz",
      product_weight: 0.0008,
      dimensions: { width: 0.8, length: 0.8, height: 14.0 }
    },
    {
      product_name: "NARS Orgasm Blush",
      product_weight: 0.0043,
      dimensions: { width: 6.5, length: 4.5, height: 1.2 }
    },
    {
      product_name: "Rare Beauty Liquid Blush",
      product_weight: 0.015,
      dimensions: { width: 2.8, length: 2.8, height: 8.5 }
    },
    {
      product_name: "Glossier Cloud Paint",
      product_weight: 0.01,
      dimensions: { width: 2.2, length: 2.2, height: 8.8 }
    },
    {
      product_name: "Morphe 35O Nature Glow Palette",
      product_weight: 0.28,
      dimensions: { width: 24.0, length: 15.5, height: 2.5 }
    },
    {
      product_name: "Tarte Shape Tape Concealer",
      product_weight: 0.01,
      dimensions: { width: 2.0, length: 2.0, height: 12.8 }
    },
    {
      product_name: "Laura Mercier Translucent Powder",
      product_weight: 0.029,
      dimensions: { width: 5.8, length: 5.8, height: 3.5 }
    },
    {
      product_name: "Huda Beauty Desert Dusk Palette",
      product_weight: 0.36,
      dimensions: { width: 20.5, length: 13.2, height: 2.8 }
    },
    {
      product_name: "Drunk Elephant Vitamin C Serum",
      product_weight: 0.015,
      dimensions: { width: 3.2, length: 3.2, height: 9.8 }
    },
    {
      product_name: "The Inkey List Hyaluronic Acid Serum",
      product_weight: 0.03,
      dimensions: { width: 2.8, length: 2.8, height: 10.5 }
    },
    {
      product_name: "Paula's Choice BHA Liquid Exfoliant",
      product_weight: 0.118,
      dimensions: { width: 4.5, length: 4.5, height: 18.2 }
    },
    {
      product_name: "Cetaphil Daily Facial Cleanser",
      product_weight: 0.237,
      dimensions: { width: 5.2, length: 3.8, height: 17.5 }
    },
    {
      product_name: "La Roche-Posay Anthelios Sunscreen",
      product_weight: 0.06,
      dimensions: { width: 4.8, length: 3.2, height: 14.5 }
    },
    {
      product_name: "Benefit Benetint Lip & Cheek Stain",
      product_weight: 0.0125,
      dimensions: { width: 2.5, length: 2.5, height: 8.2 }
    },
    {
      product_name: "Kylie Cosmetics Liquid Lipstick",
      product_weight: 0.0032,
      dimensions: { width: 1.8, length: 1.8, height: 13.5 }
    },
    {
      product_name: "Jeffree Star Velour Liquid Lipstick",
      product_weight: 0.0055,
      dimensions: { width: 2.2, length: 2.2, height: 15.8 }
    },
    {
      product_name: "Colourpop Super Shock Shadow",
      product_weight: 0.0021,
      dimensions: { width: 3.8, length: 3.8, height: 2.2 }
    },
    {
      product_name: "Milani Baked Blush",
      product_weight: 0.0035,
      dimensions: { width: 6.2, length: 4.8, height: 1.5 }
    },
    {
      product_name: "E.L.F. Camo Concealer",
      product_weight: 0.006,
      dimensions: { width: 1.5, length: 1.5, height: 11.2 }
    },
    {
      product_name: "Wet n Wild MegaGlo Highlighter",
      product_weight: 0.0055,
      dimensions: { width: 6.8, length: 4.2, height: 1.8 }
    },
    {
      product_name: "Revlon ColorStay Foundation",
      product_weight: 0.03,
      dimensions: { width: 4.5, length: 4.5, height: 11.8 }
    },
    {
      product_name: "CoverGirl TruBlend Foundation",
      product_weight: 0.03,
      dimensions: { width: 4.2, length: 4.2, height: 12.2 }
    },
    {
      product_name: "Rimmel Stay Matte Powder",
      product_weight: 0.014,
      dimensions: { width: 7.5, length: 7.5, height: 1.8 }
    },
    {
      product_name: "Essence Lash Princess Mascara",
      product_weight: 0.012,
      dimensions: { width: 2.2, length: 2.2, height: 14.5 }
    },
    {
      product_name: "NYX Angel Veil Primer",
      product_weight: 0.03,
      dimensions: { width: 3.8, length: 3.8, height: 9.5 }
    },
    {
      product_name: "Smashbox Photo Finish Primer",
      product_weight: 0.03,
      dimensions: { width: 4.2, length: 4.2, height: 10.8 }
    },
    {
      product_name: "Becca Shimmering Skin Perfector",
      product_weight: 0.0085,
      dimensions: { width: 6.5, length: 5.2, height: 1.5 }
    },
    {
      product_name: "Hourglass Ambient Lighting Powder",
      product_weight: 0.0105,
      dimensions: { width: 8.2, length: 8.2, height: 2.2 }
    },
    {
      product_name: "Stila Stay All Day Liquid Liner",
      product_weight: 0.00055,
      dimensions: { width: 1.2, length: 1.2, height: 14.8 }
    },
    {
      product_name: "Kat Von D Tattoo Liner",
      product_weight: 0.00055,
      dimensions: { width: 1.1, length: 1.1, height: 15.2 }
    },
    {
      product_name: "Physician's Formula Butter Bronzer",
      product_weight: 0.011,
      dimensions: { width: 8.5, length: 6.2, height: 2.0 }
    },
    {
      product_name: "Maybelline Baby Lips",
      product_weight: 0.0044,
      dimensions: { width: 1.8, length: 1.8, height: 7.5 }
    },
    {
      product_name: "Burt's Bees Lip Balm",
      product_weight: 0.0042,
      dimensions: { width: 1.9, length: 1.9, height: 7.8 }
    },
    {
      product_name: "ChapStick Classic",
      product_weight: 0.004,
      dimensions: { width: 1.8, length: 1.8, height: 7.2 }
    },
    {
      product_name: "Vaseline Petroleum Jelly",
      product_weight: 0.0134,
      dimensions: { width: 4.2, length: 4.2, height: 2.8 }
    },
    {
      product_name: "Aquaphor Healing Ointment",
      product_weight: 0.0198,
      dimensions: { width: 5.8, length: 3.2, height: 5.5 }
    },
    {
      product_name: "Olay Regenerist Micro-Sculpting Cream",
      product_weight: 0.048,
      dimensions: { width: 7.2, length: 7.2, height: 5.8 }
    },
    {
      product_name: "Neutrogena Oil-Free Acne Wash",
      product_weight: 0.269,
      dimensions: { width: 6.8, length: 4.2, height: 18.5 }
    },
    {
      product_name: "Clean & Clear Morning Burst",
      product_weight: 0.248,
      dimensions: { width: 6.5, length: 4.0, height: 17.8 }
    },
    {
      product_name: "St. Ives Apricot Scrub",
      product_weight: 0.17,
      dimensions: { width: 7.2, length: 4.8, height: 12.5 }
    },
    {
      product_name: "Freeman Clay Mask",
      product_weight: 0.175,
      dimensions: { width: 5.5, length: 3.8, height: 18.2 }
    },
    {
      product_name: "The Body Shop Tea Tree Oil",
      product_weight: 0.01,
      dimensions: { width: 2.8, length: 2.8, height: 7.5 }
    },
    {
      product_name: "Lush Fresh Face Mask",
      product_weight: 0.075,
      dimensions: { width: 6.5, length: 6.5, height: 3.2 }
    },
    {
      product_name: "Origins Clear Improvement Mask",
      product_weight: 0.075,
      dimensions: { width: 5.8, length: 5.8, height: 8.2 }
    },
    {
      product_name: "Kiehl's Ultra Facial Cream",
      product_weight: 0.05,
      dimensions: { width: 6.2, length: 6.2, height: 5.5 }
    },
    {
      product_name: "Fresh Sugar Lip Treatment",
      product_weight: 0.0043,
      dimensions: { width: 1.9, length: 1.9, height: 7.8 }
    },
    {
      product_name: "Bite Beauty Agave Lip Mask",
      product_weight: 0.017,
      dimensions: { width: 4.2, length: 4.2, height: 2.8 }
    },
    {
      product_name: "Laneige Lip Sleeping Mask",
      product_weight: 0.02,
      dimensions: { width: 5.5, length: 5.5, height: 3.5 }
    },
    {
      product_name: "Summer Fridays Jet Lag Mask",
      product_weight: 0.048,
      dimensions: { width: 6.8, length: 4.2, height: 12.5 }
    },
    {
      product_name: "Glow Recipe Watermelon Sleeping Mask",
      product_weight: 0.08,
      dimensions: { width: 7.5, length: 7.5, height: 6.2 }
    },
    {
      product_name: "Tatcha The Water Cream",
      product_weight: 0.05,
      dimensions: { width: 6.8, length: 6.8, height: 5.8 }
    },
    {
      product_name: "Drunk Elephant Protini Cream",
      product_weight: 0.05,
      dimensions: { width: 6.5, length: 6.5, height: 6.0 }
    },
    {
      product_name: "Youth to the People Cleanser",
      product_weight: 0.237,
      dimensions: { width: 5.8, length: 4.2, height: 16.5 }
    },
    {
      product_name: "Glossier Milky Jelly Cleanser",
      product_weight: 0.177,
      dimensions: { width: 6.2, length: 6.2, height: 12.8 }
    },
    {
      product_name: "The Ordinary Hyaluronic Acid",
      product_weight: 0.03,
      dimensions: { width: 2.8, length: 2.8, height: 9.5 }
    },
    {
      product_name: "The Ordinary Retinol 0.2%",
      product_weight: 0.03,
      dimensions: { width: 2.8, length: 2.8, height: 9.5 }
    },
    {
      product_name: "The Ordinary AHA 30% + BHA 2%",
      product_weight: 0.03,
      dimensions: { width: 2.8, length: 2.8, height: 9.5 }
    },
    {
      product_name: "Paula's Choice 2% BHA Liquid",
      product_weight: 0.03,
      dimensions: { width: 3.8, length: 3.8, height: 12.5 }
    },
    {
      product_name: "Pixi Glow Tonic",
      product_weight: 0.25,
      dimensions: { width: 6.2, length: 4.2, height: 18.8 }
    },
    {
      product_name: "Thayers Rose Petal Toner",
      product_weight: 0.355,
      dimensions: { width: 6.8, length: 4.5, height: 20.5 }
    },
    {
      product_name: "Mario Badescu Facial Spray",
      product_weight: 0.118,
      dimensions: { width: 4.8, length: 4.8, height: 15.2 }
    },
    {
      product_name: "Heritage Store Rosewater",
      product_weight: 0.237,
      dimensions: { width: 5.5, length: 5.5, height: 18.5 }
    },
    {
      product_name: "Evian Facial Spray",
      product_weight: 0.15,
      dimensions: { width: 4.2, length: 4.2, height: 16.8 }
    },
    {
      product_name: "Caudalie Beauty Elixir",
      product_weight: 0.03,
      dimensions: { width: 3.5, length: 3.5, height: 12.2 }
    },
    {
      product_name: "Herbivore Blue Tansy Mask",
      product_weight: 0.088,
      dimensions: { width: 6.8, length: 6.8, height: 7.2 }
    },
    {
      product_name: "Sunday Riley Good Genes",
      product_weight: 0.03,
      dimensions: { width: 4.2, length: 4.2, height: 10.5 }
    },
    {
      product_name: "Skinceuticals CE Ferulic",
      product_weight: 0.03,
      dimensions: { width: 3.8, length: 3.8, height: 9.8 }
    },
    {
      product_name: "La Mer Moisturizing Cream",
      product_weight: 0.03,
      dimensions: { width: 5.8, length: 5.8, height: 4.2 }
    },
    {
      product_name: "SK-II Facial Treatment Essence",
      product_weight: 0.23,
      dimensions: { width: 6.5, length: 4.8, height: 18.5 }
    },
    {
      product_name: "Shiseido Ultimune Serum",
      product_weight: 0.03,
      dimensions: { width: 4.2, length: 4.2, height: 11.8 }
    },
    {
      product_name: "Lancome Advanced Genifique",
      product_weight: 0.03,
      dimensions: { width: 4.5, length: 4.5, height: 11.5 }
    },
    {
      product_name: "Clarins Double Serum",
      product_weight: 0.03,
      dimensions: { width: 4.8, length: 4.8, height: 10.8 }
    },
    {
      product_name: "Estee Lauder Advanced Night Repair",
      product_weight: 0.03,
      dimensions: { width: 4.2, length: 4.2, height: 12.2 }
    },
    {
      product_name: "Clinique Moisture Surge",
      product_weight: 0.05,
      dimensions: { width: 6.2, length: 6.2, height: 6.5 }
    },
    {
      product_name: "Origins GinZing Eye Cream",
      product_weight: 0.015,
      dimensions: { width: 4.2, length: 4.2, height: 3.8 }
    },
    {
      product_name: "Kiehl's Creamy Eye Treatment",
      product_weight: 0.014,
      dimensions: { width: 4.5, length: 4.5, height: 3.5 }
    },
    {
      product_name: "Olay Eyes Ultimate Eye Cream",
      product_weight: 0.015,
      dimensions: { width: 4.8, length: 3.2, height: 8.5 }
    },
    {
      product_name: "RoC Retinol Correxion Eye Cream",
      product_weight: 0.015,
      dimensions: { width: 4.2, length: 3.5, height: 8.2 }
    },
    {
      product_name: "No7 Protect & Perfect Eye Cream",
      product_weight: 0.015,
      dimensions: { width: 4.5, length: 3.8, height: 7.8 }
    },
    {
      product_name: "L'Oreal Revitalift Eye Cream",
      product_weight: 0.015,
      dimensions: { width: 4.2, length: 3.2, height: 8.0 }
    },
    {
      product_name: "Garnier SkinActive Eye Cream",
      product_weight: 0.015,
      dimensions: { width: 4.0, length: 3.5, height: 7.5 }
    },
    {
      product_name: "Pond's Rejuveness Eye Cream",
      product_weight: 0.0135,
      dimensions: { width: 4.2, length: 3.8, height: 6.8 }
    },
    {
      product_name: "Aveeno Daily Moisturizing Lotion",
      product_weight: 0.532,
      dimensions: { width: 7.2, length: 4.8, height: 22.5 }
    },
    {
      product_name: "Jergens Ultra Healing Lotion",
      product_weight: 0.621,
      dimensions: { width: 7.8, length: 5.2, height: 24.2 }
    },
    {
      product_name: "Bath & Body Works Lotion",
      product_weight: 0.236,
      dimensions: { width: 5.8, length: 4.2, height: 18.5 }
    },
    {
      product_name: "Victoria's Secret Body Mist",
      product_weight: 0.25,
      dimensions: { width: 5.2, length: 5.2, height: 19.8 }
    },
    {
      product_name: "Sol de Janeiro Brazilian Bum Bum Cream",
      product_weight: 0.24,
      dimensions: { width: 6.8, length: 6.8, height: 12.5 }
    },
    {
      product_name: "Tree Hut Shea Sugar Scrub",
      product_weight: 0.51,
      dimensions: { width: 9.2, length: 9.2, height: 8.5 }
    },
    {
      product_name: "Dove Beauty Bar",
      product_weight: 0.106,
      dimensions: { width: 8.2, length: 5.8, height: 3.2 }
    },
    {
      product_name: "Olay Body Wash",
      product_weight: 0.532,
      dimensions: { width: 7.5, length: 4.2, height: 22.8 }
    },
    {
      product_name: "Johnson's Baby Oil",
      product_weight: 0.414,
      dimensions: { width: 6.8, length: 4.5, height: 19.5 }
    },
    {
      product_name: "Palmer's Cocoa Butter Formula",
      product_weight: 0.25,
      dimensions: { width: 6.2, length: 4.8, height: 16.8 }
    },
    {
      product_name: "Nivea Creme",
      product_weight: 0.169,
      dimensions: { width: 8.5, length: 8.5, height: 4.2 }
    },
    {
      product_name: "Eucerin Original Healing Cream",
      product_weight: 0.454,
      dimensions: { width: 9.2, length: 6.8, height: 12.5 }
    },
    {
      product_name: "Gold Bond Ultimate Healing Lotion",
      product_weight: 0.414,
      dimensions: { width: 7.2, length: 4.8, height: 20.5 }
    }
  ];

  console.log('Starting to seed products...');

  for (const product of cosmeticsProducts) {
    try {
      const createdProduct = await productsService.create(product);
      console.log(`✅ Created: ${createdProduct.product_name}`);
    } catch (error) {
      console.log(`❌ Failed to create ${product.product_name}: ${error.message}`);
    }
  }

  console.log('Seeding completed!');
  await app.close();
}

seedProducts().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});

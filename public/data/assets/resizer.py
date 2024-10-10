from PIL import Image
import os

# Paths to your local images
image_paths = [
    'units/Combat Engineers.png',
    'units/Combat Medical Unit.png',
    'units/Infantry Unit.png',
    'units/Irregular Unit.png',
    'units/Mechanized Infantry.png',
    'units/Power Armored Infantry.png',
    'units/Sappers.png',
    'units/Special Forces.png'
]

# Set the desired size for all images (e.g., 500x500 pixels)
desired_size = (500, 500)

# Output directory for resized images
output_dir = 'units/'
os.makedirs(output_dir, exist_ok=True)

# Resize and save each image
for image_path in image_paths:
    with Image.open(image_path) as img:
        # Resize image while maintaining aspect ratio
        img.thumbnail(desired_size)  # Removed Image.ANTIALIAS

        # Create a new image with the desired size and paste the resized image onto the center
        new_img = Image.new('RGBA', desired_size, (0, 0, 0, 0))  # Transparent background
        new_img.paste(img, ((desired_size[0] - img.width) // 2, (desired_size[1] - img.height) // 2))

        # Save the resized image
        base_name = os.path.basename(image_path)
        output_path = os.path.join(output_dir, base_name)
        new_img.save(output_path, format='PNG')

print("Resizing complete. Images saved to:", output_dir)

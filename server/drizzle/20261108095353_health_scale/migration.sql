-- The one-time rescale: health is now in hundredths of a Hitpoints level, so armour percentages leave whole numbers.
UPDATE `players` SET `health` = `health` * 100;

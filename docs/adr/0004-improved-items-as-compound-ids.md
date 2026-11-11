# Improved items are compound id strings, not item objects

An improved item carries its Quality and Virtue in its id: the base id, then the Quality, then the Virtue, all in one string (for example `copperChestplate:uncommon:fortitude`). Every place an item lives already holds one string id: inventory slots, the ten worn-gear fields and save columns, and ground items. So a compound id needs no change to the save schema, the synced schema or ground items, and old saves need no conversion, since a plain id is a common item. We ruled out a separate table entry for every item, Quality and Virtue, which multiplies hundreds of entries across the metal tiers. We also ruled out items that carry their own data as objects, which would change the shape of every inventory slot, gear field, save column and ground item for the sake of two values.

## Consequences

- One shared helper splits an id into its base id, Quality and Virtue. Every lookup that reads gear stats, stack size, gates, names, icons or the worn look goes through it and reads the base id.
- An improved item meets the same gate, wears the same look and keeps the same base stats as its common form. Only the Virtue and how the item is named and framed differ.
- Worn gear syncs to every player in the room, so they all see a player's Quality and Virtue. This is intended.
- Gear stacks to 1, so stacking never compares Virtues. A stackable item that could be improved would need stacking to match the whole id.

export interface Destination {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  type: 'building' | 'parking' | 'entrance' | 'facility';
  category: 'academic' | 'hostel' | 'parking' | 'sports' | 'dining' | 'entrance' | 'facility';
}

export const destinations: Destination[] = [
  // Gates
  { 
    id: 'gate1', 
    name: 'Gate 1', 
    coordinates: [77.43481925768538, 12.863850429793658], 
    type: 'entrance', 
    category: 'entrance' 
  },
  { 
    id: 'gate2', 
    name: 'Gate 2', 
    coordinates: [77.43546296330163, 12.86470316433497], 
    type: 'entrance', 
    category: 'entrance' 
  },
  
  // Parking Areas
  { 
    id: 'parking-2wheeler', 
    name: '2-Wheeler square parking', 
    coordinates: [77.4374163344977, 12.863552296439337], 
    type: 'parking', 
    category: 'parking' 
  },
  { 
    id: 'parking-4wheeler', 
    name: '4-Wheeler parking', 
    coordinates: [77.43669981966787, 12.86239674425859], 
    type: 'parking', 
    category: 'parking' 
  },
  { 
    id: 'architecture-parking', 
    name: 'Architecture Block Parking', 
    coordinates: [77.43821903615282, 12.860409482350079], 
    type: 'parking', 
    category: 'parking' 
  },
  { 
    id: 'devadan-parking', 
    name: 'Devadan Block Parking', 
    coordinates: [77.43975872567984, 12.8602477931111], 
    type: 'parking', 
    category: 'parking' 
  },
  
  // Block Entrances
  { 
    id: 'block1-ent1', 
    name: 'Block 1 Entrance 1', 
    coordinates: [77.43782561277385, 12.863109667613244], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block1-ent2', 
    name: 'Block 1 Entrance 2', 
    coordinates: [77.43808994247621, 12.862903964780855], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block2-ent1', 
    name: 'Block 2 Entrance 1', 
    coordinates: [77.43845694186865, 12.862808722038366], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block2-ent2', 
    name: 'Block 2 Entrance 2', 
    coordinates: [77.43820756575195, 12.8629320428591], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block3-ent1', 
    name: 'Block 3 Entrance 1', 
    coordinates: [77.4387243884484, 12.8626924481634], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block3-ent2', 
    name: 'Block 3 Entrance 2', 
    coordinates: [77.43897376456675, 12.862551509943302], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block4-ent1', 
    name: 'Block 4 Entrance 1', 
    coordinates: [77.43902484895551, 12.862229785762992], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block4-ent2', 
    name: 'Block 4 Entrance 2', 
    coordinates: [77.43900135700119, 12.862488760013122], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block5-ent1', 
    name: 'Block 5 Entrance 1', 
    coordinates: [77.43871742444207, 12.862062935829513], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block6-ent1', 
    name: 'Block 6 Entrance 1', 
    coordinates: [77.43985429471928, 12.862176933718871], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'block6-ent2', 
    name: 'Block 6 Entrance 2', 
    coordinates: [77.43970972885603, 12.862302016579704], 
    type: 'entrance', 
    category: 'academic' 
  },
  
  // Hostels
  { 
    id: 'mens-hostel-a', 
    name: "Men's Hostel Block A", 
    coordinates: [77.43938149190649, 12.859847831427828], 
    type: 'building', 
    category: 'hostel' 
  },
  { 
    id: 'mens-hostel-b', 
    name: "Men's Hostel Block B", 
    coordinates: [77.43937209634873, 12.859829511643255], 
    type: 'building', 
    category: 'hostel' 
  },
  { 
    id: 'mens-hostel-c', 
    name: "Men's Hostel Block C", 
    coordinates: [77.43930069011583, 12.859862487255171], 
    type: 'building', 
    category: 'hostel' 
  },
  { 
    id: 'mens-hostel-d', 
    name: "Men's Hostel Block D", 
    coordinates: [77.43930256922778, 12.85988630297149], 
    type: 'building', 
    category: 'hostel' 
  },
  { 
    id: 'girls-hostel', 
    name: 'Girls Hostel', 
    coordinates: [77.4390190811809, 12.862529869112151], 
    type: 'building', 
    category: 'hostel' 
  },
  
  // Academic Buildings
  { 
    id: 'architecture-block', 
    name: 'Architecture Block Basement', 
    coordinates: [77.43846839394229, 12.860418016623058], 
    type: 'building', 
    category: 'academic' 
  },
  { 
    id: 'devadan-block1-ent1', 
    name: 'Devadan Block 1 Entrance 1', 
    coordinates: [77.43965035462793, 12.860308098057388], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'devadan-block1-ent2', 
    name: 'Devadan Block 1 Entrance 2', 
    coordinates: [77.4393363943725, 12.859626161266974], 
    type: 'entrance', 
    category: 'academic' 
  },
  { 
    id: 'devadan-block2', 
    name: 'Devadan Block 2', 
    coordinates: [77.43930835635507, 12.86036488927816], 
    type: 'building', 
    category: 'academic' 
  },
  { 
    id: 'pu-block', 
    name: 'PU Block', 
    coordinates: [77.43719150389848, 12.860438142311537], 
    type: 'building', 
    category: 'academic' 
  },
  { 
    id: 'center-excellence', 
    name: 'Center of Excellence', 
    coordinates: [77.43870838907469, 12.86203298638948], 
    type: 'building', 
    category: 'academic' 
  },
  
  // Facilities
  { 
    id: 'chapel-ent1', 
    name: 'Chapel Entrance 1', 
    coordinates: [77.43774627547754, 12.860274300115066], 
    type: 'entrance', 
    category: 'facility' 
  },
  { 
    id: 'chapel-ent2', 
    name: 'Chapel Entrance 2', 
    coordinates: [77.43763242978787, 12.860302488052369], 
    type: 'entrance', 
    category: 'facility' 
  },
  { 
    id: 'old-mech-workshop', 
    name: 'Old Mech Workshop', 
    coordinates: [77.43838323365014, 12.86226633159616], 
    type: 'building', 
    category: 'facility' 
  },
  { 
    id: 'guest-house', 
    name: 'Private Guest House', 
    coordinates: [77.43940975535367, 12.862328442692856], 
    type: 'building', 
    category: 'facility' 
  },
  { 
    id: 'students-square', 
    name: 'Students Square', 
    coordinates: [77.43825, 12.862250], 
    type: 'facility', 
    category: 'facility' 
  },
  
  // Sports Facilities  
  { 
    id: 'basketball-front1', 
    name: 'Basketball Front 1', 
    coordinates: [77.43717633019247, 12.861919275431703], 
    type: 'facility', 
    category: 'sports' 
  },
  { 
    id: 'basketball-front2', 
    name: 'Basketball Front 2', 
    coordinates: [77.43713476750696, 12.861665585797084], 
    type: 'facility', 
    category: 'sports' 
  },
  { 
    id: 'basketball-back1', 
    name: 'Basketball Back 1', 
    coordinates: [77.43532700490272, 12.861315811543236], 
    type: 'facility', 
    category: 'sports' 
  },
  { 
    id: 'basketball-back2', 
    name: 'Basketball Back 2', 
    coordinates: [77.4351390692783, 12.861373948854848], 
    type: 'facility', 
    category: 'sports' 
  },
  { 
    id: 'ground1', 
    name: 'Ground 1', 
    coordinates: [77.43687450360937, 12.861833627388421], 
    type: 'facility', 
    category: 'sports' 
  },
  { 
    id: 'ground2', 
    name: 'Ground 2', 
    coordinates: [77.4414007929206, 12.858504091691202], 
    type: 'facility', 
    category: 'sports' 
  },
  { 
    id: 'tennis-court', 
    name: 'Tennis Court', 
    coordinates: [77.436922418873, 12.86121002757936], 
    type: 'facility', 
    category: 'sports' 
  },
  { 
    id: 'amphi-theater1', 
    name: 'Amphi Theater 1', 
    coordinates: [77.43871079931074, 12.860093756972347], 
    type: 'facility', 
    category: 'facility' 
  },
  { 
    id: 'amphi-theater2', 
    name: 'Amphi Theater 2', 
    coordinates: [77.43806431459484, 12.860944057375377], 
    type: 'facility', 
    category: 'facility' 
  },
  { 
    id: 'band-stand', 
    name: 'Band Stand', 
    coordinates: [77.43653931712652, 12.862741655288488], 
    type: 'facility', 
    category: 'facility' 
  },
  
  // Dining
  { 
    id: 'north-canteen', 
    name: 'North Canteen', 
    coordinates: [77.439229285024, 12.859701272437263], 
    type: 'facility', 
    category: 'dining' 
  },
  { 
    id: 'kns-canteen', 
    name: 'KNS Canteen', 
    coordinates: [77.43683399502129, 12.862644094750792], 
    type: 'facility', 
    category: 'dining' 
  },
  { 
    id: 'punjabi-bites', 
    name: 'Panjabi Bites Canteen', 
    coordinates: [77.43763362144955, 12.863268422383427], 
    type: 'facility', 
    category: 'dining' 
  },
  { 
    id: 'mba-canteen', 
    name: 'MBA Canteen', 
    coordinates: [77.43760483011465, 12.863216962928576], 
    type: 'facility', 
    category: 'dining' 
  },
  { 
    id: 'block1-canteen', 
    name: 'Block 1 Canteen Entrance', 
    coordinates: [77.43782162225921, 12.863098055917249], 
    type: 'entrance', 
    category: 'dining' 
  }
];
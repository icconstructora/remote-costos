// ── CONSUMIDO MES A MES (CDD + CID) ──────────────────────────────────────────
// CDD : Costos Directos (sin CDD99, sin CID56)
// CID : CID51 nomina + CID52 + CID53 + CID54  (sin CID56, sin CDD99)
const CORTE_CONSUMIDO = "30 Abr 2026";

const CONSUMIDO_DATA = {
  // pra-e1 — CDD:[105]  NOM:[103]
  'pra-e1': [
    { label:'Jul 25', cdd: 1602601074, cid: 100259671 },
    { label:'Ago 25', cdd: 1295310254, cid: 131420472 },
    { label:'Sep 25', cdd: 791498275, cid: 86074501 },
    { label:'Oct 25', cdd: 1109485957, cid: 95147825 },
    { label:'Nov 25', cdd: 1153964794, cid: 59631358 },
    { label:'Dic 25', cdd: 1033460212, cid: 82506910 },
    { label:'Ene 26', cdd: 602889074, cid: 57534054 },
    { label:'Feb 26', cdd: 1612325267, cid: 80609072 },
    { label:'Mar 26', cdd: 1559679159, cid: 93061630 },
    { label:'Abr 26', cdd: 2145449272, cid: 83539326 },
  ],

  // pra-e2 — CDD:[108]  NOM:[344]
  'pra-e2': [
    { label:'Jul 25', cdd: 633690244, cid: 27442410 },
    { label:'Ago 25', cdd: 10513592, cid: 59836915 },
    { label:'Sep 25', cdd: 812716971, cid: 73483541 },
    { label:'Oct 25', cdd: 669591566, cid: 77375115 },
    { label:'Nov 25', cdd: 1248949690, cid: 84656499 },
    { label:'Dic 25', cdd: 485644845, cid: 92187028 },
    { label:'Ene 26', cdd: 279200585, cid: 101134035 },
    { label:'Feb 26', cdd: 444473082, cid: 193828769 },
    { label:'Mar 26', cdd: 75539893, cid: 109588714 },
    { label:'Abr 26', cdd: 3317363434, cid: 78521809 },
  ],

  // praia — CDD:[105, 108]  NOM:[103, 344]
  'praia': [
    { label:'Jul 25', cdd: 2236291318, cid: 127702081 },
    { label:'Ago 25', cdd: 1305823846, cid: 191257388 },
    { label:'Sep 25', cdd: 1604215246, cid: 159558042 },
    { label:'Oct 25', cdd: 1779077523, cid: 172522940 },
    { label:'Nov 25', cdd: 2402914484, cid: 144287858 },
    { label:'Dic 25', cdd: 1519105057, cid: 174693938 },
    { label:'Ene 26', cdd: 882089658, cid: 158668090 },
    { label:'Feb 26', cdd: 2056798349, cid: 274437840 },
    { label:'Mar 26', cdd: 1635219052, cid: 202650344 },
    { label:'Abr 26', cdd: 5462812706, cid: 162061136 },
  ],

  // gaia — CDD:[160]  NOM:[162]
  'gaia': [
    { label:'Jul 25', cdd: 1372953108, cid: 73443125 },
    { label:'Ago 25', cdd: 506264703, cid: 71346836 },
    { label:'Sep 25', cdd: 417097538, cid: 74519541 },
    { label:'Oct 25', cdd: 443557842, cid: 70142698 },
    { label:'Nov 25', cdd: 430161185, cid: 68294409 },
    { label:'Dic 25', cdd: 359349042, cid: 84580929 },
    { label:'Ene 26', cdd: 147467507, cid: 59191061 },
    { label:'Feb 26', cdd: 147126697, cid: 69675252 },
    { label:'Mar 26', cdd: 214207437, cid: 76708724 },
    { label:'Abr 26', cdd: 51911135, cid: 69077981 },
  ],

  // hac-e1 — CDD:[133]  NOM:[131]
  'hac-e1': [
    { label:'Jul 25', cdd: 1726397357, cid: 129892148 },
    { label:'Ago 25', cdd: 671830525, cid: 95212713 },
    { label:'Sep 25', cdd: 594836371, cid: 90409494 },
    { label:'Oct 25', cdd: 608552355, cid: 175221326 },
    { label:'Nov 25', cdd: 676126866, cid: 125455226 },
    { label:'Dic 25', cdd: 583747011, cid: 129708721 },
    { label:'Ene 26', cdd: 504410347, cid: 110534188 },
    { label:'Feb 26', cdd: 656012102, cid: 79623988 },
    { label:'Mar 26', cdd: 816424977, cid: 149066769 },
    { label:'Abr 26', cdd: 247651340, cid: 190518001 },
  ],

  // hacienda — CDD:[133]  NOM:[131]
  'hacienda': [
    { label:'Jul 25', cdd: 1726397357, cid: 129892148 },
    { label:'Ago 25', cdd: 671830525, cid: 95212713 },
    { label:'Sep 25', cdd: 594836371, cid: 90409494 },
    { label:'Oct 25', cdd: 608552355, cid: 175221326 },
    { label:'Nov 25', cdd: 676126866, cid: 125455226 },
    { label:'Dic 25', cdd: 583747011, cid: 129708721 },
    { label:'Ene 26', cdd: 504410347, cid: 110534188 },
    { label:'Feb 26', cdd: 656012102, cid: 79623988 },
    { label:'Mar 26', cdd: 816424977, cid: 149066769 },
    { label:'Abr 26', cdd: 247651340, cid: 190518001 },
  ],

  // pri-e12 — CDD:[125, 119]  NOM:[121]
  'pri-e12': [
    { label:'Jul 25', cdd: 2357149801, cid: 237728010 },
    { label:'Ago 25', cdd: 1420531969, cid: 191687625 },
    { label:'Sep 25', cdd: 1234757753, cid: 161921226 },
    { label:'Oct 25', cdd: 1435455718, cid: 170895798 },
    { label:'Nov 25', cdd: 1249446604, cid: 196555533 },
    { label:'Dic 25', cdd: 1658291776, cid: 243513386 },
    { label:'Ene 26', cdd: 365948246, cid: 182685257 },
    { label:'Feb 26', cdd: 747443385, cid: 183431072 },
    { label:'Mar 26', cdd: 746354541, cid: 244361793 },
    { label:'Abr 26', cdd: 1649193544, cid: 185707092 },
  ],

  // primera — CDD:[125, 119]  NOM:[121]
  'primera': [
    { label:'Jul 25', cdd: 2357149801, cid: 237728010 },
    { label:'Ago 25', cdd: 1420531969, cid: 191687625 },
    { label:'Sep 25', cdd: 1234757753, cid: 161921226 },
    { label:'Oct 25', cdd: 1435455718, cid: 170895798 },
    { label:'Nov 25', cdd: 1249446604, cid: 196555533 },
    { label:'Dic 25', cdd: 1658291776, cid: 243513386 },
    { label:'Ene 26', cdd: 365948246, cid: 182685257 },
    { label:'Feb 26', cdd: 747443385, cid: 183431072 },
    { label:'Mar 26', cdd: 746354541, cid: 244361793 },
    { label:'Abr 26', cdd: 1649193544, cid: 185707092 },
  ],

  // well — CDD:[190]  NOM:[192]
  'well': [
    { label:'Jul 25', cdd: 1872147579, cid: 75449251 },
    { label:'Ago 25', cdd: 1358239436, cid: 100010053 },
    { label:'Sep 25', cdd: 806235609, cid: 120147867 },
    { label:'Oct 25', cdd: 1604742383, cid: 67674769 },
    { label:'Nov 25', cdd: 939270869, cid: 100034674 },
    { label:'Dic 25', cdd: 1688282720, cid: 94614083 },
    { label:'Ene 26', cdd: 809649416, cid: 97571844 },
    { label:'Feb 26', cdd: 481008069, cid: 108719012 },
    { label:'Mar 26', cdd: 1615552804, cid: 92234178 },
    { label:'Abr 26', cdd: 1183447611, cid: 119536795 },
  ],

  // opo-e12 — CDD:[117]  NOM:[(116, 'ETAPA 1')]
  'opo-e12': [
    { label:'Jul 25', cdd: 20672760, cid: 4126788 },
    { label:'Ago 25', cdd: 139425571, cid: 3087420 },
    { label:'Sep 25', cdd: 436802356, cid: 0 },
    { label:'Oct 25', cdd: 95293231, cid: 24930492 },
    { label:'Nov 25', cdd: 51253751, cid: 6395060 },
    { label:'Dic 25', cdd: 632217570, cid: 1649968 },
    { label:'Ene 26', cdd: 267478751, cid: 9951151 },
    { label:'Feb 26', cdd: 70057914, cid: 0 },
    { label:'Mar 26', cdd: 99560814, cid: 2209000 },
    { label:'Abr 26', cdd: 127304318, cid: 0 },
  ],

  // opo-e3 — CDD:[118]  NOM:[(116, 'ETAPA 3'), 401]
  'opo-e3': [
    { label:'Jul 25', cdd: 6758831, cid: 123090355 },
    { label:'Ago 25', cdd: 14749105, cid: 99138878 },
    { label:'Sep 25', cdd: 258381999, cid: 109599144 },
    { label:'Oct 25', cdd: 357882664, cid: 91499786 },
    { label:'Nov 25', cdd: 667202423, cid: 101591392 },
    { label:'Dic 25', cdd: 635249840, cid: 99000476 },
    { label:'Ene 26', cdd: 742537634, cid: 102797101 },
    { label:'Feb 26', cdd: 566490746, cid: 110491626 },
    { label:'Mar 26', cdd: 617483276, cid: 113224383 },
    { label:'Abr 26', cdd: 806938084, cid: 163311194 },
  ],

  // oporto — CDD:[117, 118]  NOM:[116, 401]
  'oporto': [
    { label:'Jul 25', cdd: 27431591, cid: 127217143 },
    { label:'Ago 25', cdd: 154174676, cid: 102226297 },
    { label:'Sep 25', cdd: 695184356, cid: 109599144 },
    { label:'Oct 25', cdd: 453175895, cid: 116430278 },
    { label:'Nov 25', cdd: 718456174, cid: 107986452 },
    { label:'Dic 25', cdd: 1267467411, cid: 100650444 },
    { label:'Ene 26', cdd: 1010016385, cid: 112748252 },
    { label:'Feb 26', cdd: 636548660, cid: 110491626 },
    { label:'Mar 26', cdd: 717044090, cid: 115433383 },
    { label:'Abr 26', cdd: 934242402, cid: 163311194 },
  ],

  // bosque — CDD:[147]  NOM:[143]
  'bosque': [
    { label:'Jul 25', cdd: 248968986, cid: 209243175 },
    { label:'Ago 25', cdd: 289014981, cid: 140704306 },
    { label:'Sep 25', cdd: 245442151, cid: 201223124 },
    { label:'Oct 25', cdd: 200060974, cid: 179754140 },
    { label:'Nov 25', cdd: 344344613, cid: 98076618 },
    { label:'Dic 25', cdd: 313139836, cid: 102621502 },
    { label:'Ene 26', cdd: 60951836, cid: 120410585 },
    { label:'Feb 26', cdd: 536357677, cid: 147295452 },
    { label:'Mar 26', cdd: 414423281, cid: 127285554 },
    { label:'Abr 26', cdd: 679338341, cid: 113826393 },
  ],

  // cast-l — CDD:[155]  NOM:[157]
  'cast-l': [
    { label:'Jul 25', cdd: 3071790955, cid: 111384674 },
    { label:'Ago 25', cdd: 1074387452, cid: 152878017 },
    { label:'Sep 25', cdd: 4116265926, cid: 133940132 },
    { label:'Oct 25', cdd: 4662606416, cid: 121194541 },
    { label:'Nov 25', cdd: 2469815495, cid: 134688903 },
    { label:'Dic 25', cdd: 2852684368, cid: 160136480 },
    { label:'Ene 26', cdd: 1227089721, cid: 122202979 },
    { label:'Feb 26', cdd: 4269622440, cid: 133895006 },
    { label:'Mar 26', cdd: 2206833966, cid: 213578174 },
    { label:'Abr 26', cdd: 1631049702, cid: 136194746 },
  ],

  // azt-e1 — CDD:[168]  NOM:[]
  'azt-e1': [
    { label:'Jul 25', cdd: 57508, cid: 0 },
    { label:'Ago 25', cdd: 0, cid: 0 },
    { label:'Sep 25', cdd: 0, cid: 0 },
    { label:'Oct 25', cdd: 0, cid: 0 },
    { label:'Nov 25', cdd: 0, cid: 0 },
    { label:'Dic 25', cdd: 0, cid: 0 },
    { label:'Ene 26', cdd: 0, cid: 0 },
    { label:'Feb 26', cdd: 0, cid: 0 },
    { label:'Mar 26', cdd: 0, cid: 0 },
    { label:'Abr 26', cdd: 155288684, cid: 0 },
  ],

  // azt-e2 — CDD:[169]  NOM:[]
  'azt-e2': [
    { label:'Jul 25', cdd: 26244001, cid: 21142700 },
    { label:'Ago 25', cdd: 81285355, cid: 31444444 },
    { label:'Sep 25', cdd: 275011988, cid: 31733828 },
    { label:'Oct 25', cdd: 37948884, cid: 33790755 },
    { label:'Nov 25', cdd: 118823653, cid: 48718931 },
    { label:'Dic 25', cdd: 114954442, cid: 47336269 },
    { label:'Ene 26', cdd: 37948038, cid: 19626909 },
    { label:'Feb 26', cdd: 56956385, cid: 18751876 },
    { label:'Mar 26', cdd: 90073278, cid: 2968096 },
    { label:'Abr 26', cdd: 455997537, cid: 3137504 },
  ],

  // azul-t — CDD:[168, 169]  NOM:[167]
  'azul-t': [
    { label:'Jul 25', cdd: 26301509, cid: 64584978 },
    { label:'Ago 25', cdd: 81285355, cid: 82053238 },
    { label:'Sep 25', cdd: 275011988, cid: 82363915 },
    { label:'Oct 25', cdd: 37948884, cid: 76179691 },
    { label:'Nov 25', cdd: 118823653, cid: 92621945 },
    { label:'Dic 25', cdd: 114954442, cid: 93720188 },
    { label:'Ene 26', cdd: 37948038, cid: 50056401 },
    { label:'Feb 26', cdd: 56956385, cid: 43124419 },
    { label:'Mar 26', cdd: 90073278, cid: 34908075 },
    { label:'Abr 26', cdd: 611286222, cid: 32859483 },
  ],

  // azc-e1 — CDD:[174]  NOM:[]
  'azc-e1': [
    { label:'Jul 25', cdd: 85431896, cid: 23487770 },
    { label:'Ago 25', cdd: 0, cid: 23898900 },
    { label:'Sep 25', cdd: 34873940, cid: 30378930 },
    { label:'Oct 25', cdd: 1189994, cid: 18171540 },
    { label:'Nov 25', cdd: 0, cid: 13473600 },
    { label:'Dic 25', cdd: 13802943, cid: 6646150 },
    { label:'Ene 26', cdd: 0, cid: 62663570 },
    { label:'Feb 26', cdd: 6988294, cid: 0 },
    { label:'Mar 26', cdd: 26345050, cid: 0 },
    { label:'Abr 26', cdd: 22481437, cid: 0 },
  ],

  // azc-e2 — CDD:[175]  NOM:[]
  'azc-e2': [
    { label:'Jul 25', cdd: 25693953, cid: 3185119 },
    { label:'Ago 25', cdd: 28781090, cid: 3760107 },
    { label:'Sep 25', cdd: 17809814, cid: 6016244 },
    { label:'Oct 25', cdd: 1575796, cid: 5453023 },
    { label:'Nov 25', cdd: 32270565, cid: 5267317 },
    { label:'Dic 25', cdd: 15768196, cid: 6116019 },
    { label:'Ene 26', cdd: 351781, cid: 11706540 },
    { label:'Feb 26', cdd: 69859323, cid: 139728 },
    { label:'Mar 26', cdd: 25944177, cid: 116440 },
    { label:'Abr 26', cdd: 98546918, cid: 0 },
  ],

  // azc-e3 — CDD:[176]  NOM:[]
  'azc-e3': [
    { label:'Jul 25', cdd: 0, cid: 0 },
    { label:'Ago 25', cdd: 0, cid: 0 },
    { label:'Sep 25', cdd: 113917864, cid: 0 },
    { label:'Oct 25', cdd: 0, cid: 0 },
    { label:'Nov 25', cdd: 0, cid: 0 },
    { label:'Dic 25', cdd: 0, cid: 0 },
    { label:'Ene 26', cdd: 0, cid: 0 },
    { label:'Feb 26', cdd: 0, cid: 0 },
    { label:'Mar 26', cdd: 0, cid: 0 },
    { label:'Abr 26', cdd: 61053521, cid: 0 },
  ],

  // azul-c — CDD:[174, 175, 176]  NOM:[173]
  'azul-c': [
    { label:'Jul 25', cdd: 111125849, cid: 38660703 },
    { label:'Ago 25', cdd: 28781090, cid: 40455098 },
    { label:'Sep 25', cdd: 166601617, cid: 49437049 },
    { label:'Oct 25', cdd: 2765790, cid: 33516675 },
    { label:'Nov 25', cdd: 32270565, cid: 27641386 },
    { label:'Dic 25', cdd: 29571139, cid: 21090093 },
    { label:'Ene 26', cdd: 351781, cid: 80793108 },
    { label:'Feb 26', cdd: 76847617, cid: 6797398 },
    { label:'Mar 26', cdd: 52289227, cid: 6781046 },
    { label:'Abr 26', cdd: 182081876, cid: 6671540 },
  ],

  // ver-e1 — CDD:[180]  NOM:[]
  'ver-e1': [
    { label:'Jul 25', cdd: 21292857, cid: 0 },
    { label:'Ago 25', cdd: 16705774, cid: 0 },
    { label:'Sep 25', cdd: 102268294, cid: 0 },
    { label:'Oct 25', cdd: 31044590, cid: 0 },
    { label:'Nov 25', cdd: 12960104, cid: 0 },
    { label:'Dic 25', cdd: 0, cid: 0 },
    { label:'Ene 26', cdd: 6968640, cid: 0 },
    { label:'Feb 26', cdd: 0, cid: 0 },
    { label:'Mar 26', cdd: 0, cid: 0 },
    { label:'Abr 26', cdd: 1693739, cid: 0 },
  ],

  // ver-e2 — CDD:[181]  NOM:[]
  'ver-e2': [
    { label:'Jul 25', cdd: 91452767, cid: 1823000 },
    { label:'Ago 25', cdd: 28233592, cid: 535598 },
    { label:'Sep 25', cdd: 411072700, cid: 309291 },
    { label:'Oct 25', cdd: 24961440, cid: 812129 },
    { label:'Nov 25', cdd: 51286317, cid: 355264 },
    { label:'Dic 25', cdd: 1558189, cid: 259008 },
    { label:'Ene 26', cdd: 226029869, cid: 259008 },
    { label:'Feb 26', cdd: 213707827, cid: 259008 },
    { label:'Mar 26', cdd: 0, cid: 224473 },
    { label:'Abr 26', cdd: 26901731, cid: 0 },
  ],

  // ver-e3 — CDD:[182]  NOM:[]
  'ver-e3': [
    { label:'Jul 25', cdd: 0, cid: 0 },
    { label:'Ago 25', cdd: 4620100, cid: 0 },
    { label:'Sep 25', cdd: 0, cid: 0 },
    { label:'Oct 25', cdd: 0, cid: 0 },
    { label:'Nov 25', cdd: 0, cid: 0 },
    { label:'Dic 25', cdd: 0, cid: 0 },
    { label:'Ene 26', cdd: 5099058, cid: 0 },
    { label:'Feb 26', cdd: 70322053, cid: 0 },
    { label:'Mar 26', cdd: 0, cid: 0 },
    { label:'Abr 26', cdd: 0, cid: 0 },
  ],

  // verde — CDD:[180, 181, 182]  NOM:[179]
  'verde': [
    { label:'Jul 25', cdd: 112745624, cid: 28674781 },
    { label:'Ago 25', cdd: 49559466, cid: 15868357 },
    { label:'Sep 25', cdd: 513340994, cid: 16201266 },
    { label:'Oct 25', cdd: 56006030, cid: 15999803 },
    { label:'Nov 25', cdd: 64246421, cid: 13602909 },
    { label:'Dic 25', cdd: 1558189, cid: 9169147 },
    { label:'Ene 26', cdd: 238097567, cid: 1748513 },
    { label:'Feb 26', cdd: 284029880, cid: 259008 },
    { label:'Mar 26', cdd: 0, cid: 649303 },
    { label:'Abr 26', cdd: 28595469, cid: 0 },
  ],

  // mit-11 — CDD:[186, 184]  NOM:[185]
  'mit-11': [
    { label:'Jul 25', cdd: 4506239, cid: 7364140 },
    { label:'Ago 25', cdd: 0, cid: 7348570 },
    { label:'Sep 25', cdd: 45287147, cid: 8410250 },
    { label:'Oct 25', cdd: 0, cid: 9598420 },
    { label:'Nov 25', cdd: 0, cid: 9080790 },
    { label:'Dic 25', cdd: 0, cid: 0 },
    { label:'Ene 26', cdd: 0, cid: 0 },
    { label:'Feb 26', cdd: 0, cid: 0 },
    { label:'Mar 26', cdd: 0, cid: 0 },
    { label:'Abr 26', cdd: 0, cid: 0 },
  ],

  // mit-t5 — CDD:[408]  NOM:[409]
  'mit-t5': [
    { label:'Jul 25', cdd: 0, cid: 0 },
    { label:'Ago 25', cdd: 0, cid: 0 },
    { label:'Sep 25', cdd: 0, cid: 0 },
    { label:'Oct 25', cdd: 0, cid: 0 },
    { label:'Nov 25', cdd: 0, cid: 0 },
    { label:'Dic 25', cdd: 0, cid: 0 },
    { label:'Ene 26', cdd: 304289045, cid: 0 },
    { label:'Feb 26', cdd: 313875918, cid: 6580118 },
    { label:'Mar 26', cdd: 413428819, cid: 37789078 },
    { label:'Abr 26', cdd: 25449167, cid: 78668861 },
  ],

  // mit-t6 — CDD:[187]  NOM:[189]
  'mit-t6': [
    { label:'Jul 25', cdd: 55515807, cid: 37622587 },
    { label:'Ago 25', cdd: 309169267, cid: 47040044 },
    { label:'Sep 25', cdd: 810727223, cid: 34850669 },
    { label:'Oct 25', cdd: 573384760, cid: 51242941 },
    { label:'Nov 25', cdd: 540881617, cid: 53467849 },
    { label:'Dic 25', cdd: 609796620, cid: 52314264 },
    { label:'Ene 26', cdd: 321459436, cid: 37256350 },
    { label:'Feb 26', cdd: 318961688, cid: 34368879 },
    { label:'Mar 26', cdd: 258890931, cid: 53584420 },
    { label:'Abr 26', cdd: 189733020, cid: 12858461 },
  ],

  // mit-t7 — CDD:[188]  NOM:[337]
  'mit-t7': [
    { label:'Jul 25', cdd: 382863483, cid: 51393024 },
    { label:'Ago 25', cdd: 793688489, cid: 32675287 },
    { label:'Sep 25', cdd: 619254249, cid: 53040358 },
    { label:'Oct 25', cdd: 1017398077, cid: 39106935 },
    { label:'Nov 25', cdd: 914754011, cid: 53353972 },
    { label:'Dic 25', cdd: 674994624, cid: 48302140 },
    { label:'Ene 26', cdd: 385926896, cid: 34050698 },
    { label:'Feb 26', cdd: 393228427, cid: 34998729 },
    { label:'Mar 26', cdd: 371383080, cid: 50120693 },
    { label:'Abr 26', cdd: 194689789, cid: 12318454 },
  ],

  // mit-12 — CDD:[408, 187, 188]  NOM:[409, 189, 337]
  'mit-12': [
    { label:'Jul 25', cdd: 438379290, cid: 106015611 },
    { label:'Ago 25', cdd: 1102857756, cid: 96715331 },
    { label:'Sep 25', cdd: 1429981472, cid: 104891028 },
    { label:'Oct 25', cdd: 1590782837, cid: 107349877 },
    { label:'Nov 25', cdd: 1455635629, cid: 123821821 },
    { label:'Dic 25', cdd: 1284791245, cid: 117616405 },
    { label:'Ene 26', cdd: 1011675377, cid: 88307048 },
    { label:'Feb 26', cdd: 1026066033, cid: 92947726 },
    { label:'Mar 26', cdd: 1043702830, cid: 158494192 },
    { label:'Abr 26', cdd: 409871977, cid: 120845777 },
  ],

  // mitika — CDD:[186, 184, 408, 187, 188]  NOM:[185, 409, 189, 337]
  'mitika': [
    { label:'Jul 25', cdd: 442885529, cid: 113379751 },
    { label:'Ago 25', cdd: 1102857756, cid: 104063901 },
    { label:'Sep 25', cdd: 1475268618, cid: 113301278 },
    { label:'Oct 25', cdd: 1590782837, cid: 116948297 },
    { label:'Nov 25', cdd: 1455635629, cid: 132902611 },
    { label:'Dic 25', cdd: 1284791245, cid: 117616405 },
    { label:'Ene 26', cdd: 1011675377, cid: 88307048 },
    { label:'Feb 26', cdd: 1026066033, cid: 92947726 },
    { label:'Mar 26', cdd: 1043702830, cid: 158494192 },
    { label:'Abr 26', cdd: 409871977, cid: 120845777 },
  ],

  // cai-e2b — CDD:[201]  NOM:[195]
  'cai-e2b': [
    { label:'Jul 25', cdd: 67917112, cid: 12643107 },
    { label:'Ago 25', cdd: 41185845, cid: 11250520 },
    { label:'Sep 25', cdd: 122065968, cid: 6609705 },
    { label:'Oct 25', cdd: 32390418, cid: 13612861 },
    { label:'Nov 25', cdd: 7215710, cid: 15335843 },
    { label:'Dic 25', cdd: 29616225, cid: 50969133 },
    { label:'Ene 26', cdd: 0, cid: 45403355 },
    { label:'Feb 26', cdd: 200254582, cid: 6118698 },
    { label:'Mar 26', cdd: 39652841, cid: 4986432 },
    { label:'Abr 26', cdd: 3138269, cid: 16856194 },
  ],

  // cast-i — CDD:[201, 193]  NOM:[195]
  'cast-i': [
    { label:'Jul 25', cdd: 102094450, cid: 12643107 },
    { label:'Ago 25', cdd: 65178750, cid: 11250520 },
    { label:'Sep 25', cdd: 150089376, cid: 6609705 },
    { label:'Oct 25', cdd: 38891375, cid: 13612861 },
    { label:'Nov 25', cdd: 7215710, cid: 15335843 },
    { label:'Dic 25', cdd: 29616225, cid: 50969133 },
    { label:'Ene 26', cdd: 96745265, cid: 45403355 },
    { label:'Feb 26', cdd: 591878951, cid: 6118698 },
    { label:'Mar 26', cdd: 370601836, cid: 4986432 },
    { label:'Abr 26', cdd: 467989492, cid: 16856194 },
  ],

};

// ── DETALLE CID ÚLTIMOS 3 MESES ───────────────────────────────────────────────
// cid51: Nómina personal obra
// cid52: Servicios Públicos
// cid53: Gastos de Obra
// cid54: SST Obra
// cid_int: Interventoría (MovDocCuenta interventoria.xlsx)

const CONSUMIDO_DETALLE = {
  'pra-e1': [
    { label:'Feb 26', cid51: 49895680, cid52: 0, cid53: 5908484, cid54: 3901668, cid_int: 20903240 },
    { label:'Mar 26', cid51: 65208804, cid52: 0, cid53: 4013864, cid54: 2935722, cid_int: 20903240 },
    { label:'Abr 26', cid51: 58104287, cid52: 0, cid53: 3980599, cid54: 551200, cid_int: 20903240 },
  ],

  'pra-e2': [
    { label:'Feb 26', cid51: 45571265, cid52: 5157463, cid53: 22415414, cid54: 114884627, cid_int: 5800000 },
    { label:'Mar 26', cid51: 45971346, cid52: 5217323, cid53: 40176951, cid54: 12423094, cid_int: 5800000 },
    { label:'Abr 26', cid51: 41908138, cid52: 5135863, cid53: 21212046, cid54: 4465762, cid_int: 5800000 },
  ],

  'praia': [
    { label:'Feb 26', cid51: 95466945, cid52: 5157463, cid53: 28323897, cid54: 118786295, cid_int: 26703240 },
    { label:'Mar 26', cid51: 111180150, cid52: 5217323, cid53: 44190815, cid54: 15358816, cid_int: 26703240 },
    { label:'Abr 26', cid51: 100012425, cid52: 5135863, cid53: 25192646, cid54: 5016962, cid_int: 26703240 },
  ],

  'gaia': [
    { label:'Feb 26', cid51: 39716726, cid52: 3010402, cid53: 19830624, cid54: 0, cid_int: 7117500 },
    { label:'Mar 26', cid51: 45523112, cid52: 2829162, cid53: 20689041, cid54: 549909, cid_int: 7117500 },
    { label:'Abr 26', cid51: 39621663, cid52: 3032562, cid53: 19306256, cid54: 0, cid_int: 7117500 },
  ],

  'hac-e1': [
    { label:'Feb 26', cid51: 77373932, cid52: 110842, cid53: 562714, cid54: 1576500, cid_int: 0 },
    { label:'Mar 26', cid51: 77810696, cid52: 4308942, cid53: 64472626, cid54: 2474505, cid_int: 0 },
    { label:'Abr 26', cid51: 72229351, cid52: 1474916, cid53: 19324165, cid54: 952000, cid_int: 96537569 },
  ],

  'hacienda': [
    { label:'Feb 26', cid51: 77373932, cid52: 110842, cid53: 562714, cid54: 1576500, cid_int: 0 },
    { label:'Mar 26', cid51: 77810696, cid52: 4308942, cid53: 64472626, cid54: 2474505, cid_int: 0 },
    { label:'Abr 26', cid51: 72229351, cid52: 1474916, cid53: 19324165, cid54: 952000, cid_int: 96537569 },
  ],

  'pri-e12': [
    { label:'Feb 26', cid51: 95403860, cid52: 14384550, cid53: 32489285, cid54: 4753455, cid_int: 36399922 },
    { label:'Mar 26', cid51: 136466784, cid52: 15793800, cid53: 56680627, cid54: 3776831, cid_int: 31643751 },
    { label:'Abr 26', cid51: 104313428, cid52: 14978870, cid53: 30680775, cid54: 4090268, cid_int: 31643751 },
  ],

  'primera': [
    { label:'Feb 26', cid51: 95403860, cid52: 14384550, cid53: 32489285, cid54: 4753455, cid_int: 36399922 },
    { label:'Mar 26', cid51: 136466784, cid52: 15793800, cid53: 56680627, cid54: 3776831, cid_int: 31643751 },
    { label:'Abr 26', cid51: 104313428, cid52: 14978870, cid53: 30680775, cid54: 4090268, cid_int: 31643751 },
  ],

  'well': [
    { label:'Feb 26', cid51: 73756985, cid52: 4975850, cid53: 27905418, cid54: 2080759, cid_int: 0 },
    { label:'Mar 26', cid51: 80059291, cid52: 4377270, cid53: 6885533, cid54: 912084, cid_int: 0 },
    { label:'Abr 26', cid51: 72778507, cid52: 5770367, cid53: 39986018, cid54: 1001903, cid_int: 0 },
  ],

  'opo-e12': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 2209000, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'opo-e3': [
    { label:'Feb 26', cid51: 62287362, cid52: 1011872, cid53: 22513216, cid54: 2050660, cid_int: 22628516 },
    { label:'Mar 26', cid51: 64592842, cid52: 1234653, cid53: 24361972, cid54: 406400, cid_int: 22628516 },
    { label:'Abr 26', cid51: 66843172, cid52: 29402710, cid53: 23837055, cid54: 20599741, cid_int: 22628516 },
  ],

  'oporto': [
    { label:'Feb 26', cid51: 62287362, cid52: 1011872, cid53: 22513216, cid54: 2050660, cid_int: 22628516 },
    { label:'Mar 26', cid51: 64592842, cid52: 1234653, cid53: 26570972, cid54: 406400, cid_int: 22628516 },
    { label:'Abr 26', cid51: 66843172, cid52: 29402710, cid53: 23837055, cid54: 20599741, cid_int: 22628516 },
  ],

  'bosque': [
    { label:'Feb 26', cid51: 85414755, cid52: 4753505, cid53: 30083200, cid54: 2009176, cid_int: 25034816 },
    { label:'Mar 26', cid51: 78350043, cid52: 2462992, cid53: 22149143, cid54: 0, cid_int: 24323376 },
    { label:'Abr 26', cid51: 64934564, cid52: 2094941, cid53: 21819012, cid54: 654500, cid_int: 24323376 },
  ],

  'cast-l': [
    { label:'Feb 26', cid51: 87576625, cid52: 9766066, cid53: 14375077, cid54: 1429707, cid_int: 20747531 },
    { label:'Mar 26', cid51: 90323687, cid52: 18647350, cid53: 82945205, cid54: 914401, cid_int: 20747531 },
    { label:'Abr 26', cid51: 87685952, cid52: 13998780, cid53: 12693479, cid54: 1069004, cid_int: 20747531 },
  ],

  'azt-e1': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'azt-e2': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 18751876, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 2968096, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 3137504, cid54: 0, cid_int: 0 },
  ],

  'azul-t': [
    { label:'Feb 26', cid51: 24372543, cid52: 0, cid53: 18751876, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 31939979, cid52: 0, cid53: 2968096, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 29721979, cid52: 0, cid53: 3137504, cid54: 0, cid_int: 0 },
  ],

  'azc-e1': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'azc-e2': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 139728, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 116440, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'azc-e3': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'azul-c': [
    { label:'Feb 26', cid51: 6657670, cid52: 0, cid53: 139728, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 6664606, cid52: 0, cid53: 116440, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 6671540, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'ver-e1': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'ver-e2': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 259008, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 224473, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'ver-e3': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'verde': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 259008, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 424830, cid52: 0, cid53: 224473, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'mit-11': [
    { label:'Feb 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 0, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
  ],

  'mit-t5': [
    { label:'Feb 26', cid51: 6580118, cid52: 0, cid53: 0, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 11012513, cid52: 9568020, cid53: 16708770, cid54: 499775, cid_int: 0 },
    { label:'Abr 26', cid51: 52533440, cid52: 9426650, cid53: 16708771, cid54: 0, cid_int: 0 },
  ],

  'mit-t6': [
    { label:'Feb 26', cid51: 32998850, cid52: 0, cid53: 1370029, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 33090011, cid52: 1166822, cid53: 18042387, cid54: 1285200, cid_int: 0 },
    { label:'Abr 26', cid51: 12175834, cid52: 0, cid53: 682627, cid54: 0, cid_int: 0 },
  ],

  'mit-t7': [
    { label:'Feb 26', cid51: 33452614, cid52: 212499, cid53: 1333616, cid54: 0, cid_int: 0 },
    { label:'Mar 26', cid51: 32565438, cid52: 0, cid53: 17555255, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 10754339, cid52: 212499, cid53: 1333616, cid54: 18000, cid_int: 0 },
  ],

  'mit-12': [
    { label:'Feb 26', cid51: 73031582, cid52: 212499, cid53: 2703645, cid54: 0, cid_int: 17000000 },
    { label:'Mar 26', cid51: 76667962, cid52: 10734842, cid53: 52306413, cid54: 1784975, cid_int: 17000000 },
    { label:'Abr 26', cid51: 75463613, cid52: 9639149, cid53: 18725015, cid54: 18000, cid_int: 17000000 },
  ],

  'mitika': [
    { label:'Feb 26', cid51: 73031582, cid52: 212499, cid53: 2703645, cid54: 0, cid_int: 17000000 },
    { label:'Mar 26', cid51: 76667962, cid52: 10734842, cid53: 52306413, cid54: 1784975, cid_int: 17000000 },
    { label:'Abr 26', cid51: 75463613, cid52: 9639149, cid53: 18725015, cid54: 18000, cid_int: 17000000 },
  ],

  'cai-e2b': [
    { label:'Feb 26', cid51: 3255372, cid52: 891549, cid53: 1785542, cid54: 186235, cid_int: 0 },
    { label:'Mar 26', cid51: 3570332, cid52: 0, cid53: 1416100, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 7313792, cid52: 1737729, cid53: 7761000, cid54: 43673, cid_int: 0 },
  ],

  'cast-i': [
    { label:'Feb 26', cid51: 3255372, cid52: 891549, cid53: 1785542, cid54: 186235, cid_int: 0 },
    { label:'Mar 26', cid51: 3570332, cid52: 0, cid53: 1416100, cid54: 0, cid_int: 0 },
    { label:'Abr 26', cid51: 7313792, cid52: 1737729, cid53: 7761000, cid54: 43673, cid_int: 0 },
  ],

};
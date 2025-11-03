import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../utils/api";
import { useEffect, useState } from "react";
import Loader from "../../components/Loader/Loader";
import "../../components/Card/Card.css";
import "./SearchFilter.css";

const SearchFilter = () => {
  const [querySearch] = useSearchParams();
  const keyword = (querySearch.get("keyword") ?? "").trim();

  const [dataSearch, setDataSearch] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [noResults, setNoResults] = useState(false);

  // Estados por imagen: loading y error por _id
  const [imageLoading, setImageLoading] = useState({});
  const [imageError, setImageError] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setHasError(false);
      setNoResults(false);

      try {
        const res = await api.searchChannels(keyword);

        if (cancelled) return;

        // Soporta res.data = [] o res.data.data = []
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
          ? res.data.data
          : [];

        setDataSearch(list);
        setNoResults(list.length === 0);

        // Inicializa estado de carga por imagen en true
        const initialLoading = {};
        list.forEach((item) => {
          if (item?._id) initialLoading[item._id] = true;
        });
        setImageLoading(initialLoading);
        setImageError({});
      } catch (error) {
        if (cancelled) return;
        console.error("Error al obtener las señales:", error);
        setHasError(true);
        setDataSearch([]);
        setNoResults(false);
        setImageLoading({});
        setImageError({});
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (keyword) {
      fetchData();
    } else {
      // Si no hay keyword, no se consulta y se muestra “sin resultados”
      setDataSearch([]);
      setNoResults(true);
      setHasError(false);
      setIsLoading(false);
      setImageLoading({});
      setImageError({});
    }

    return () => {
      cancelled = true;
    };
  }, [keyword]);

  const handleClick = (e) => {
    const card = e.target.closest(".card__container");
    const id = card?.dataset.id;
    if (id) navigate(`/channels/${id}`);
  };

  // Handlers por imagen
  const handleImageLoad = (id) => {
    setImageLoading((prev) => ({ ...prev, [id]: false }));
  };

  const handleImageError = (id) => {
    setImageLoading((prev) => ({ ...prev, [id]: false }));
    setImageError((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="container__result">
      {isLoading ? (
        <Loader message="Cargando y conectando con el servidor..." />
      ) : hasError ? (
        <p className="error__data">
          Error al conectar. Comuníquese con el administrador.
        </p>
      ) : noResults ? (
        <p className="error__data">
          No se encontraron resultados para: <strong>{keyword}</strong>
        </p>
      ) : (
        <div className="container__search">
          <span className="search__register">
            {dataSearch.length === 1
              ? `Se encontró ${dataSearch.length} registro`
              : `Se encontraron ${dataSearch.length} registros`}
          </span>

          <div className="card__list">
            {dataSearch.map((signalItem) => {
              const id = signalItem?._id;
              const isImgLoading = !!imageLoading[id];
              const hasImgError = !!imageError[id];

              return (
                <div
                  className="card__container"
                  key={id}
                  data-id={id}
                  onClick={handleClick}
                >
                  <div className="card__group-item">
                    <h4 className="card__title">{signalItem.nameChannel}</h4>
                    <div className="card__number">
                      <h5 className="card__number-item">
                        {`Norte: ${signalItem.numberChannelCn}`}
                      </h5>
                      <h5 className="card__number-item">
                        {`Sur: ${signalItem.numberChannelSur}`}
                      </h5>
                    </div>
                  </div>

                  {/* Imagen con loader y fallback */}
                  <div className="card__image-wrapper">
                    {isImgLoading && <div className="card__spinner" />}

                    {!hasImgError ? (
                      <img
                        className="card__logo"
                        src={signalItem.logoChannel}
                        alt={`Logo de ${signalItem.nameChannel}`}
                        onLoad={() => handleImageLoad(id)}
                        onError={() => handleImageError(id)}
                        // Evita parpadeo mientras carga
                        style={{ visibility: isImgLoading ? "hidden" : "visible" }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="card__logo--fallback" aria-label="Sin logo">
                        Sin logo
                      </div>
                    )}
                  </div>

                  <div className="card__severidad">
                    <span>{signalItem.tipoTecnologia}</span>
                    <br />
                    <span>{`Severidad: ${signalItem.severidadChannel}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilter;

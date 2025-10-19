import { useCallback, useEffect, useMemo, useState } from "react";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";

import ModalComponent from "../../components/ModalComponent/ModalComponent";
import api from "../../utils/api";
import stylesIrd from "./Ird.module.css";

const ipMulticastRegex =
  /^(2+(?:[0-4]\d|5[0-5])\.(?:[0-9]{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(?:[0-9]{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(?:[0-9]{1,2}|1\d\d|2[0-4]\d|25[0-5]))$/;

const ipVideoMulticast = /^(192.168)?\.(\d{1,3}\.)\d{1,3}$/;

const DEFAULT_IRD_VALUES = {
  urlIrd: "",
  nombreIrd: "",
  ipAdminIrd: "",
  marcaIrd: "",
  modelIrd: "",
  versionIrd: "",
  uaIrd: "",
  tidReceptor: "",
  typeReceptor: "",
  feqReceptor: "",
  symbolRateIrd: "",
  fecReceptorIrd: "",
  modulationReceptorIrd: "",
  rellOfReceptor: "",
  nidReceptor: "",
  cvirtualReceptor: "",
  vctReceptor: "",
  outputReceptor: "",
  swAdmin: "",
  portSw: "",
  multicastReceptor: "",
  ipVideoMulticast: "",
  locationRow: "",
  locationCol: "",

  // NUEVO: control del comportamiento post-actualización
  recreateEquipo: true,
};

const FIELD_GROUPS = [
  [
    { name: "urlIrd", label: "Url imagen", placeholder: "Url imagen" },
    { name: "nombreIrd", label: "Nombre Ird", placeholder: "Nombre Ird" },
    { name: "marcaIrd", label: "Marca", placeholder: "Marca" },
    { name: "modelIrd", label: "Modelo", placeholder: "Modelo" },
    { name: "ipAdminIrd", label: "Ip administración", placeholder: "Ip administración" },
    { name: "versionIrd", label: "Versión", placeholder: "Versión" },
  ],
  [
    { name: "tidReceptor", label: "TID", placeholder: "TID" },
    { name: "typeReceptor", label: "Tipo receptor", placeholder: "Tipo receptor" },
    { name: "feqReceptor", label: "Frecuencia", placeholder: "Frecuencia" },
    { name: "symbolRateIrd", label: "Symbol Rate", placeholder: "Symbol Rate" },
    { name: "fecReceptorIrd", label: "FEC", placeholder: "FEC" },
    { name: "uaIrd", label: "UA", placeholder: "UA" },
  ],
  [
    { name: "modulationReceptorIrd", label: "Modulación", placeholder: "Modulación" },
    { name: "rellOfReceptor", label: "Roll Of", placeholder: "Roll Of" },
    { name: "nidReceptor", label: "Nid", placeholder: "Nid" },
    { name: "cvirtualReceptor", label: "Canal Virtual", placeholder: "Canal Virtual" },
    { name: "vctReceptor", label: "VCT", placeholder: "VCT" },
    { name: "swAdmin", label: "SW Admin", placeholder: "SW Admin" },
    { name: "outputReceptor", label: "Salida", placeholder: "Salida" },
    { name: "multicastReceptor", label: "Multicast Receptor", placeholder: "Multicast Receptor" },
    { name: "ipVideoMulticast", label: "Ip Video Multicast", placeholder: "Ip Video Multicast" },
    { name: "locationRow", label: "Fila", placeholder: "Fila" },
    { name: "locationCol", label: "Bastidor", placeholder: "Bastidor" },
    { name: "portSw", label: "SW Port", placeholder: "SW Port" },
  ],
];

const UpdateIrdSchema = Yup.object().shape({
  urlIrd: Yup.string().matches(
    /(?:https?:\/\/\w+\.\w+\.\w+.+)/,
    "Ingresa una url válida"
  ),
  ipAdminIrd: Yup.string().matches(
    /^172\.19\.\d{1,3}\.\d{1,3}$/,
    "Ingresa una ip válida"
  ),
  nombreIrd: Yup.string(),
  marcaIrd: Yup.string(),
  modelIrd: Yup.string(),
  versionIrd: Yup.string(),
  uaIrd: Yup.string(),
  tidReceptor: Yup.string(),
  typeReceptor: Yup.string(),
  feqReceptor: Yup.string(),
  symbolRateIrd: Yup.string(),
  fecReceptorIrd: Yup.string(),
  modulationReceptorIrd: Yup.string(),
  rellOfReceptor: Yup.string(),
  nidReceptor: Yup.string(),
  cvirtualReceptor: Yup.string(),
  vctReceptor: Yup.string(),
  outputReceptor: Yup.string(),
  swAdmin: Yup.string(),
  portSw: Yup.string(),
  multicastReceptor: Yup.string().matches(
    ipMulticastRegex,
    "Debe ser una multicast válida"
  ),
  ipVideoMulticast: Yup.string().matches(
    ipVideoMulticast,
    "Debe ser una ip válida"
  ),
  locationRow: Yup.string().matches(/\d+/, "Ingrese un número"),
  locationCol: Yup.string().matches(/\d+/, "Ingrese un número"),
  recreateEquipo: Yup.boolean(),
});

const ModalIrd = ({ itemId, modalOpen, setModalOpen, title, refreshList }) => {
  const [dataIrd, setDataIrd] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!modalOpen) {
      setDataIrd(null);
      setLoading(false);
      return;
    }

    if (!itemId) {
      setDataIrd(DEFAULT_IRD_VALUES);
      return;
    }

    let active = true;

    const fetchData = async () => {
      setLoading(true);

      try {
        const { data } = await api.getIdIrd(itemId);
        if (!active) return;
        setDataIrd(data ?? DEFAULT_IRD_VALUES);
      } catch (error) {
        if (!active) return;
        console.error("Error al obtener IRD:", error);
        Swal.fire({
          icon: "error",
          title: "Ups!!",
          text: `${error.response?.data?.message || "Error desconocido"}`,
        });
        setDataIrd(DEFAULT_IRD_VALUES);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [itemId, modalOpen]);

  const initialValues = useMemo(
    () => ({ ...DEFAULT_IRD_VALUES, ...(dataIrd ?? {}) }),
    [dataIrd]
  );

  const handleSubmit = useCallback(
    async (values, { resetForm, setSubmitting }) => {
      if (!itemId) {
        Swal.fire({
          icon: "error",
          title: "Ups!!",
          text: "No se encontró el identificador del equipo",
        });
        setSubmitting(false);
        return;
      }

      try {
        // 1) Actualiza el IRD
        await api.updateIrd(itemId, values);

        let equipoMsg = "";
        // 2) Si corresponde, recrea/sincroniza el Equipo vinculado a partir del IRD
        if (values.recreateEquipo) {
          try {
            // Endpoint sugerido: POST /irds/:id/recreate-equipo
            await api.recreateEquipoFromIrd(itemId);
            equipoMsg = "<p>Equipo vinculado recreado correctamente.</p>";
          } catch (eqErr) {
            console.error("Error al recrear el Equipo desde IRD:", eqErr);
            equipoMsg =
              "<p><strong>Advertencia:</strong> El IRD se actualizó, pero no se pudo recrear el Equipo. Revisa los logs.</p>";
          }
        }

        Swal.fire({
          icon: "success",
          title: "IRD actualizado",
          html: `
            <h4>${values.nombreIrd || "(sin nombre)"}</h4>
            <h4>${values.modelIrd || ""}</h4>
            <p>El IRD se ha actualizado exitosamente.</p>
            ${equipoMsg}
          `,
        });

        refreshList?.();
        setModalOpen(false);
        resetForm({ values });
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Ups!!",
          text: `${error.response?.data?.message || "Error desconocido"}`,
        });
        console.error(error);
      } finally {
        setSubmitting(false);
      }
    },
    [itemId, refreshList, setModalOpen]
  );

  const renderField = (field, errors, touched) => {
    const error = errors[field.name];
    const isTouched = touched[field.name];

    return (
      <div className="form__group" key={field.name}>
        <label htmlFor={field.name} className="form__group-label">
          {field.label}
          <Field
            id={field.name}
            name={field.name}
            type={field.type || "text"}
            className="form__group-input"
            placeholder={field.placeholder ?? field.label}
          />
        </label>
        {error && isTouched ? (
          <div className="form__group-error">{error}</div>
        ) : null}
      </div>
    );
  };

  return (
    <Formik
      enableReinitialize
      initialValues={initialValues}
      validationSchema={UpdateIrdSchema}
      onSubmit={handleSubmit}
    >
      {({ errors, touched, isSubmitting, values }) => (
        <ModalComponent
          modalOpen={modalOpen}
          title={title}
          setModalOpen={setModalOpen}
        >
          {loading ? (
            <div className="modal__body-loading" aria-live="polite">
              <span className="loader" aria-hidden="true" />
              <span>Cargando información...</span>
            </div>
          ) : (
            <Form className={`form__add ${stylesIrd.formGrid}`} noValidate>
              <div className={stylesIrd.rows__group}>
                {FIELD_GROUPS.map((group, groupIndex) => (
                  <div
                    className={stylesIrd.columns__group}
                    key={`group-${groupIndex}`}
                  >
                    {group.map((field) => renderField(field, errors, touched))}
                  </div>
                ))}
              </div>

              {/* NUEVO: opción de recrear equipo vinculado */}
              <div className="form__group" style={{ marginTop: "0.75rem" }}>
                <label htmlFor="recreateEquipo" className="form__group-label" style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                  <Field
                    id="recreateEquipo"
                    name="recreateEquipo"
                    type="checkbox"
                  />
                  Recrear equipo vinculado después de guardar
                </label>
              </div>

              <button
                type="submit"
                className={`button btn-primary ${stylesIrd.submitButton}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Guardando..." : "Enviar"}
              </button>
            </Form>
          )}
        </ModalComponent>
      )}
    </Formik>
  );
};

export default ModalIrd;
